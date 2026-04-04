import 'dotenv/config';
import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { parseString } from 'xml2js';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq, asc } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { db, sql as pgClient } from '../db/index.js';
import type { NewTrackingPoint} from '../db/schema.js';
import { trackingPoints, stravaTokens, stravaActivities } from '../db/schema.js';
import { auth } from './auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// --- Ensure tables exist ---
async function ensureTables() {
  await pgClient`
    CREATE TABLE IF NOT EXISTS tracking_points (
      id SERIAL PRIMARY KEY,
      garmin_id TEXT UNIQUE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      altitude DOUBLE PRECISION,
      timestamp TEXT NOT NULL,
      velocity DOUBLE PRECISION,
      course DOUBLE PRECISION,
      message TEXT,
      event_type TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await pgClient`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified BOOLEAN NOT NULL,
      image TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;
  await pgClient`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expires_at TIMESTAMP NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES "user"(id),
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;
  await pgClient`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES "user"(id),
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at TIMESTAMP,
      refresh_token_expires_at TIMESTAMP,
      scope TEXT,
      password TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;
  await pgClient`
    CREATE TABLE IF NOT EXISTS strava_tokens (
      id SERIAL PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      athlete_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await pgClient`
    CREATE TABLE IF NOT EXISTS strava_activities (
      id SERIAL PRIMARY KEY,
      strava_id BIGINT UNIQUE NOT NULL,
      name TEXT,
      type TEXT,
      distance DOUBLE PRECISION,
      moving_time INTEGER,
      elevation_gain DOUBLE PRECISION,
      start_date TEXT,
      coords TEXT,
      synced_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  // Add elevation_gain column if missing, re-sync activities to populate it
  await pgClient`
    ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS elevation_gain DOUBLE PRECISION
  `.catch((err: unknown) => { console.warn('Could not add elevation_gain column:', err); });
  await pgClient`
    DELETE FROM strava_activities WHERE elevation_gain IS NULL
  `.catch((err: unknown) => { console.warn('Could not clean strava_activities:', err); });

  await pgClient`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `;
}
// ensureTables() is awaited in startServer() below

// --- Garmin inReach MapShare feed ---
function parseKML(xml: string): Promise<any> {
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function fetchGarminPoints(mapshareId: string): Promise<NewTrackingPoint[]> {
  const url = `https://share.garmin.com/Feed/Share/${mapshareId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Garmin feed returned ${res.status}`);
  const xml = await res.text();
  const kml = await parseKML(xml);

  const points: NewTrackingPoint[] = [];
  const doc = kml?.kml?.Document;
  if (!doc) return points;

  let placemarks = doc.Folder?.Placemark || doc.Placemark;
  if (!placemarks) return points;
  if (!Array.isArray(placemarks)) placemarks = [placemarks];

  for (const pm of placemarks) {
    const extData: Record<string, string> = {};
    if (pm.ExtendedData?.Data) {
      let dataEntries = pm.ExtendedData.Data;
      if (!Array.isArray(dataEntries)) dataEntries = [dataEntries];
      for (const d of dataEntries) {
        extData[d.$.name] = d.value;
      }
    }

    const coords: string | undefined = pm.Point?.coordinates;
    if (!coords) continue;

    const [lng, lat, alt] = coords.split(',').map(Number);
    const elevation = extData['Elevation'] ? parseFloat(extData['Elevation']) : null;
    const finalAlt = (alt != null && !isNaN(alt)) ? alt : elevation;

    points.push({
      garminId: extData['Id'] || `${lat}-${lng}-${extData['Time UTC'] || ''}`,
      latitude: lat,
      longitude: lng,
      altitude: finalAlt,
      timestamp: extData['Time UTC'] || new Date().toISOString(),
      velocity: extData['Velocity'] ? parseFloat(extData['Velocity']) : null,
      course: extData['Course'] ? parseFloat(extData['Course']) : null,
      message: extData['Text'] || pm.description || null,
      eventType: extData['Event'] || null,
    });
  }

  return points;
}

async function insertPoints(points: NewTrackingPoint[]): Promise<number> {
  let newCount = 0;
  for (const pt of points) {
    try {
      await db.insert(trackingPoints).values(pt).onConflictDoNothing();
      newCount++;
    } catch {
      // duplicate garmin_id, skip
    }
  }
  return newCount;
}

async function getAllPoints() {
  return db.select().from(trackingPoints).orderBy(asc(trackingPoints.timestamp));
}

// --- Static files (production: serve Vite build) ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../dist/client')));
}

// --- Better Auth handler (must be before express.json) ---
app.all("/api/auth/{*splat}", toNodeHandler(auth));

app.use(express.json());

// --- Auth middleware ---
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

// --- API routes ---

app.get('/api/me', async (req: Request, res: Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    res.json({ user: null, isAdmin: false });
    return;
  }
  const isAdmin = ADMIN_EMAILS.includes(session.user.email);
  res.json({ user: session.user, isAdmin });
});

app.get('/api/points', async (_req: Request, res: Response) => {
  const points = await getAllPoints();
  res.json(points);
});

app.post('/api/sync', requireAuth, async (_req: Request, res: Response) => {
  const mapshareId = process.env.MAPSHARE_ID;
  if (!mapshareId) {
    res.status(400).json({ error: 'MAPSHARE_ID environment variable not set' });
    return;
  }

  try {
    const points = await fetchGarminPoints(mapshareId);
    const newCount = await insertPoints(points);
    const allPoints = await getAllPoints();
    addSyncLog('garmin', `Manual sync: ${newCount} new points (${allPoints.length} total)`);
    res.json({ synced: newCount, total: allPoints.length, points: allPoints });
  } catch (err) {
    console.error('Sync error:', err);
    addSyncLog('garmin', `Manual sync error: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/points', requireAuth, async (req: Request, res: Response) => {
  const { latitude, longitude, altitude, message, tag } = req.body as Record<string, unknown>;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: 'Invalid latitude/longitude' });
    return;
  }
  if (altitude != null && typeof altitude !== 'number') {
    res.status(400).json({ error: 'Invalid altitude' });
    return;
  }
  if (message != null && typeof message !== 'string') {
    res.status(400).json({ error: 'Invalid message' });
    return;
  }
  if (tag != null && typeof tag !== 'string') {
    res.status(400).json({ error: 'Invalid tag' });
    return;
  }

  const point: NewTrackingPoint = {
    garminId: `manual-${Date.now()}`,
    latitude,
    longitude,
    altitude: altitude != null ? altitude : null,
    timestamp: new Date().toISOString(),
    velocity: null,
    course: null,
    message: message || null,
    eventType: tag || 'manual',
  };

  await db.insert(trackingPoints).values(point);
  res.json({ ok: true, point });
});

app.delete('/api/points/:id', requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid point ID' });
    return;
  }
  await db.delete(trackingPoints).where(eq(trackingPoints.id, id));
  res.json({ ok: true });
});

// --- Ghost CMS proxy ---
const GHOST_URL = process.env.GHOST_URL || 'https://ghost-production-1882.up.railway.app';
const GHOST_KEY = process.env.GHOST_CONTENT_API_KEY || '0d6476834a0eeaa76e910081c9';

app.get('/api/blog/posts', async (req: Request, res: Response) => {
  try {
    const order = req.query.order === 'asc' ? 'published_at%20asc' : 'published_at%20desc';
    const ghostRes = await fetch(
      `${GHOST_URL}/ghost/api/content/posts/?key=${GHOST_KEY}&fields=id,title,slug,feature_image,excerpt,published_at,reading_time&order=${order}`
    );
    const data = await ghostRes.json();
    res.json(data);
  } catch (err) {
    console.error('Ghost API error:', err);
    res.status(502).json({ error: 'Failed to fetch blog posts' });
  }
});

app.get('/api/blog/posts/:slug', async (req: Request, res: Response) => {
  try {
    const ghostRes = await fetch(
      `${GHOST_URL}/ghost/api/content/posts/slug/${req.params.slug}/?key=${GHOST_KEY}&formats=html`
    );
    const data = await ghostRes.json();
    res.json(data);
  } catch (err) {
    console.error('Ghost API error:', err);
    res.status(502).json({ error: 'Failed to fetch blog post' });
  }
});

// --- Weather forecast ---
app.get('/api/weather', async (_req: Request, res: Response) => {
  try {
    const points = await getAllPoints();
    // Find last Garmin tracking point
    const lastGarmin = [...points].reverse().find(p => !p.garminId?.startsWith('manual-'));
    if (!lastGarmin) {
      res.json({ error: 'No tracking points available' });
      return;
    }

    const { latitude, longitude } = lastGarmin;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,windspeed_10m_max,windgusts_10m_max&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto&forecast_days=2`;
    const weatherRes = await fetch(url);
    const weather = await weatherRes.json();

    res.json({
      latitude,
      longitude,
      pointTimestamp: lastGarmin.timestamp,
      forecast: weather.daily,
      timezone: weather.timezone,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Strava OAuth & API ---
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

app.get('/api/strava/connect', requireAuth, (_req: Request, res: Response) => {
  if (!STRAVA_CLIENT_ID) {
    res.status(400).json({ error: 'STRAVA_CLIENT_ID not configured' });
    return;
  }
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/strava/callback`;
  const url = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read,activity:read_all&approval_prompt=auto`;
  res.json({ url });
});

app.get('/api/strava/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code || !STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    res.status(400).json({ error: 'Missing code or Strava config' });
    return;
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });
    const data = await tokenRes.json();

    if (!data.access_token) {
      res.status(400).json({ error: 'Failed to get Strava token' });
      return;
    }

    // Upsert token
    await pgClient`
      DELETE FROM strava_tokens WHERE athlete_id = ${String(data.athlete.id)}
    `;
    await db.insert(stravaTokens).values({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteId: String(data.athlete.id),
    });

    // Redirect back to app
    const appUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
    res.redirect(appUrl);
  } catch (err) {
    res.status(500).json({ error: 'Strava OAuth error: ' + (err as Error).message });
  }
});

let refreshPromise: Promise<string | null> | null = null;

async function getStravaToken(): Promise<string | null> {
  const tokens = await db.select().from(stravaTokens).limit(1);
  if (tokens.length === 0) return null;

  const token = tokens[0];
  const now = Math.floor(Date.now() / 1000);

  // Refresh if expired or expiring in 5 min
  if (token.expiresAt < now + 300) {
    // Coalesce concurrent refresh requests
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) return null;

        const refreshRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
          }),
        });
        const data = await refreshRes.json() as { access_token?: string; refresh_token?: string; expires_at?: number };

        if (!data.access_token) return null;

        await db.update(stravaTokens)
          .set({
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? token.refreshToken,
            expiresAt: data.expires_at ?? token.expiresAt,
          })
          .where(eq(stravaTokens.id, token.id));

        return data.access_token;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  return token.accessToken;
}

app.get('/api/strava/status', async (_req: Request, res: Response) => {
  const tokens = await db.select().from(stravaTokens).limit(1);
  res.json({ connected: tokens.length > 0 });
});

app.get('/api/strava/activities', async (_req: Request, res: Response) => {
  const activities = await db.select().from(stravaActivities).orderBy(asc(stravaActivities.startDate));
  res.json(activities);
});

async function syncStravaActivities() {
  const accessToken = await getStravaToken();
  if (!accessToken) return { synced: 0, error: 'Strava not connected' };

  const activitiesRes = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=200', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!activitiesRes.ok) return { synced: 0, error: `Strava API error: ${activitiesRes.status}` };
  const activities = await activitiesRes.json();

  let synced = 0;
  for (const act of activities) {
    const existing = await db.select().from(stravaActivities).where(eq(stravaActivities.stravaId, act.id));
    const hasCoords = existing.length > 0 && existing[0].coords && existing[0].coords !== '[]';
    if (hasCoords) continue;

    let coords: [number, number][] = [];
    try {
      const streamRes = await fetch(
        `https://www.strava.com/api/v3/activities/${act.id}/streams?keys=latlng&key_by_type=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (streamRes.ok) {
        const streamData = await streamRes.json();
        if (streamData.latlng?.data) {
          coords = streamData.latlng.data;
        }
      }
    } catch {
      // No GPS data for this activity
    }

    if (existing.length > 0) {
      await db.update(stravaActivities)
        .set({ coords: JSON.stringify(coords) })
        .where(eq(stravaActivities.stravaId, act.id));
    } else {
      await db.insert(stravaActivities).values({
        stravaId: act.id,
        name: act.name,
        type: act.type,
        distance: act.distance,
        movingTime: act.moving_time,
        elevationGain: act.total_elevation_gain || 0,
        startDate: act.start_date,
        coords: JSON.stringify(coords),
      });
    }
    synced++;
  }

  return { synced, total: (await db.select().from(stravaActivities)).length };
}

app.post('/api/strava/sync', requireAuth, async (_req: Request, res: Response) => {
  try {
    const result = await syncStravaActivities();
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    const all = await db.select().from(stravaActivities).orderBy(asc(stravaActivities.startDate));
    addSyncLog('strava', `Manual sync: ${result.synced} new activities (${all.length} total)`);
    res.json({ ...result, activities: all });
  } catch (err) {
    addSyncLog('strava', `Manual sync error: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Auto-polling ---
const POLL_INTERVAL = (parseInt(process.env.POLL_INTERVAL_MIN || '5') || 5) * 60 * 1000;
let lastSyncResult: { time: string | null; newCount: number; error: string | null } = {
  time: null,
  newCount: 0,
  error: null,
};

async function autoSync() {
  const mapshareId = process.env.MAPSHARE_ID;
  if (!mapshareId) return;

  try {
    const points = await fetchGarminPoints(mapshareId);
    const newCount = await insertPoints(points);
    lastSyncResult = { time: new Date().toISOString(), newCount, error: null };

    if (newCount > 0) {
      console.log(`Auto-sync: ${newCount} new points`);
      addSyncLog('garmin', `${newCount} new points synced`);
    }
  } catch (err) {
    lastSyncResult = { time: new Date().toISOString(), newCount: 0, error: (err as Error).message };
    console.error('Auto-sync error:', (err as Error).message);
    addSyncLog('garmin', `Error: ${(err as Error).message}`);
  }
}

app.get('/api/sync-status', (_req: Request, res: Response) => {
  res.json({
    ...lastSyncResult,
    pollIntervalMin: POLL_INTERVAL / 60000,
    mapshareConfigured: !!process.env.MAPSHARE_ID,
  });
});

// --- Admin status ---
const syncLogs: { source: string; time: string; message: string }[] = [];
function addSyncLog(source: string, message: string) {
  syncLogs.unshift({ source, time: new Date().toISOString(), message });
  if (syncLogs.length > 50) syncLogs.length = 50;
}

app.get('/api/admin/status', requireAuth, async (_req: Request, res: Response) => {
  const points = await getAllPoints();
  const lastGarmin = [...points].reverse().find(p => !p.garminId?.startsWith('manual-'));
  const activities = await db.select().from(stravaActivities).orderBy(asc(stravaActivities.startDate));
  const lastStrava = activities.length > 0 ? activities[activities.length - 1] : null;
  const tokens = await db.select().from(stravaTokens).limit(1);

  res.json({
    garmin: {
      configured: !!process.env.MAPSHARE_ID,
      mapshareId: process.env.MAPSHARE_ID || null,
      totalPoints: points.length,
      lastPointTime: lastGarmin?.timestamp || null,
      pollIntervalMin: POLL_INTERVAL / 60000,
    },
    strava: {
      connected: tokens.length > 0,
      athleteId: tokens[0]?.athleteId || null,
      totalActivities: activities.length,
      lastActivityDate: lastStrava?.startDate || null,
      lastActivityName: lastStrava?.name || null,
    },
    logs: syncLogs,
  });
});

// --- Health check ---
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// --- Global error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- SPA fallback (production) ---
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
  });
}

// --- Strava auto-sync (once per day) ---
const STRAVA_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

async function autoSyncStrava() {
  try {
    const result = await syncStravaActivities();
    if (result.synced > 0) {
      console.log(`Strava auto-sync: ${result.synced} new activities`);
      addSyncLog('strava', `${result.synced} new activities synced`);
    }
  } catch (err) {
    console.error('Strava auto-sync error:', (err as Error).message);
    addSyncLog('strava', `Error: ${(err as Error).message}`);
  }
}

async function startServer() {
  await ensureTables();

  const server = app.listen(PORT, () => {
    console.log(`AT Tracker running at http://localhost:${PORT}`);
    if (process.env.MAPSHARE_ID) {
      console.log(`  Auto-polling every ${POLL_INTERVAL / 60000} min (set POLL_INTERVAL_MIN to change)`);
      void autoSync();
      setInterval(() => void autoSync(), POLL_INTERVAL);
    } else {
      console.log('  Set MAPSHARE_ID env var to enable Garmin inReach sync');
    }
    if (STRAVA_CLIENT_ID) {
      console.log('  Strava auto-sync every 24h');
      void autoSyncStrava();
      setInterval(() => void autoSyncStrava(), STRAVA_SYNC_INTERVAL);
    }
  });

  const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
