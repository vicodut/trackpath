import 'dotenv/config';
import express, { Request, Response } from 'express';
import { parseString } from 'xml2js';
import path from 'path';
import { eq, asc } from 'drizzle-orm';
import { db, sql as pgClient } from '../db/index.js';
import { trackingPoints, NewTrackingPoint } from '../db/schema.js';

const app = express();
const PORT = process.env.PORT || 3000;

// --- Ensure table exists ---
async function ensureTable() {
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
}
ensureTable();

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

    points.push({
      garminId: extData['Id'] || `${lat}-${lng}-${extData['Time UTC'] || ''}`,
      latitude: lat,
      longitude: lng,
      altitude: alt || null,
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
app.use(express.json());

// --- API routes ---

app.get('/api/points', async (_req: Request, res: Response) => {
  const points = await getAllPoints();
  res.json(points);
});

app.post('/api/sync', async (_req: Request, res: Response) => {
  const mapshareId = process.env.MAPSHARE_ID;
  if (!mapshareId) {
    res.status(400).json({ error: 'MAPSHARE_ID environment variable not set' });
    return;
  }

  try {
    const points = await fetchGarminPoints(mapshareId);
    const newCount = await insertPoints(points);
    const allPoints = await getAllPoints();
    res.json({ synced: newCount, total: allPoints.length, points: allPoints });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/points', async (req: Request, res: Response) => {
  const { latitude, longitude, altitude, message } = req.body;
  if (!latitude || !longitude) {
    res.status(400).json({ error: 'latitude and longitude are required' });
    return;
  }

  const point: NewTrackingPoint = {
    garminId: `manual-${Date.now()}`,
    latitude,
    longitude,
    altitude: altitude || null,
    timestamp: new Date().toISOString(),
    velocity: null,
    course: null,
    message: message || null,
    eventType: 'manual',
  };

  await db.insert(trackingPoints).values(point);
  res.json({ ok: true, point });
});

app.delete('/api/points/:id', async (req: Request, res: Response) => {
  await db.delete(trackingPoints).where(eq(trackingPoints.id, Number(req.params.id)));
  res.json({ ok: true });
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
    }
  } catch (err) {
    lastSyncResult = { time: new Date().toISOString(), newCount: 0, error: (err as Error).message };
    console.error('Auto-sync error:', (err as Error).message);
  }
}

app.get('/api/sync-status', (_req: Request, res: Response) => {
  res.json({
    ...lastSyncResult,
    pollIntervalMin: POLL_INTERVAL / 60000,
    mapshareConfigured: !!process.env.MAPSHARE_ID,
  });
});

// --- SPA fallback (production) ---
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../../dist/client/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`AT Tracker running at http://localhost:${PORT}`);
  if (process.env.MAPSHARE_ID) {
    console.log(`  Auto-polling every ${POLL_INTERVAL / 60000} min (set POLL_INTERVAL_MIN to change)`);
    autoSync();
    setInterval(autoSync, POLL_INTERVAL);
  } else {
    console.log('  Set MAPSHARE_ID env var to enable Garmin inReach sync');
    console.log('  Example: MAPSHARE_ID=YourShareName node server.js');
  }
});
