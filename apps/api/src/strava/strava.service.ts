import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { asc, eq, count, inArray } from 'drizzle-orm';
import { stravaActivities, stravaTokens } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import { toUtcDayStart, toUtcDayEnd } from '../common/date-range.util.js';
import { SyncPeriodsService } from '../sync-periods/sync-periods.service.js';
import { HikesService } from '../hikes/hikes.service.js';
import { AppSettingsService } from '../hikes/app-settings.service.js';
import { HikeClassifierService } from '../hikes/hike-classifier.service.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type {
  StravaActivityRaw,
  StravaRefreshResponse,
  StravaStreamResponse,
  StravaTokenResponse,
  StravaSyncResult,
} from './strava.types.js';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';

/** Refresh the token 5 minutes before it expires. */
const REFRESH_BUFFER_S = 300;

/**
 * Converts a YYYY-MM-DD (or full ISO8601) date to Unix epoch seconds, used
 * for the Strava activities endpoint's `after`/`before` range params.
 */
function toEpochSeconds(date: string, bound: 'start' | 'end'): number {
  const iso = bound === 'start' ? toUtcDayStart(date) : toUtcDayEnd(date);
  return Math.floor(new Date(iso).getTime() / 1000);
}

@Injectable()
export class StravaService {
  private readonly logger = new Logger(StravaService.name);

  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly redirectBase: string;

  /**
   * Coalesces concurrent token-refresh calls so the DB is never hit with
   * multiple simultaneous UPDATE statements when several requests race.
   */
  private refreshPromise: Promise<string | null> | null = null;
  private readonly syncLogs: Array<{ source: string; time: string; message: string }> = [];

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly syncPeriodsService: SyncPeriodsService,
    private readonly hikesService: HikesService,
    private readonly appSettingsService: AppSettingsService,
    private readonly classifier: HikeClassifierService,
  ) {
    this.clientId = process.env.STRAVA_CLIENT_ID ?? null;
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET ?? null;
    this.redirectBase = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001';
  }

  // ---------------------------------------------------------------------------
  // Status / read endpoints
  // ---------------------------------------------------------------------------

  async isConnected(): Promise<boolean> {
    const rows = await this.db.select({ id: stravaTokens.id }).from(stravaTokens).limit(1);
    return rows.length > 0;
  }

  /** Returns the first token row for admin status display (athleteId). */
  async getTokenMeta(): Promise<{ athleteId: string } | null> {
    const rows = await this.db
      .select({ athleteId: stravaTokens.athleteId })
      .from(stravaTokens)
      .limit(1);
    return rows[0] ?? null;
  }

  getSyncLogs(): Array<{ source: string; time: string; message: string }> {
    return this.syncLogs;
  }

  /** Defaults to the current default hike when no hikeId is given. */
  async getActivities(hikeId?: number) {
    const resolvedHikeId = hikeId ?? (await this.appSettingsService.getDefaultHikeId());
    if (resolvedHikeId == null) return [];

    return this.db
      .select()
      .from(stravaActivities)
      .where(eq(stravaActivities.hikeId, resolvedHikeId))
      .orderBy(asc(stravaActivities.startDate));
  }

  // ---------------------------------------------------------------------------
  // OAuth flow
  // ---------------------------------------------------------------------------

  getConnectUrl(): string {
    if (!this.clientId) throw new BadRequestException('STRAVA_CLIENT_ID not configured');

    const redirectUri = `${this.redirectBase}/api/strava/callback`;
    return (
      `https://www.strava.com/oauth/authorize` +
      `?client_id=${this.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=read,activity:read_all` +
      `&approval_prompt=auto`
    );
  }

  /**
   * Exchanges the OAuth authorization code for tokens and upserts them.
   * Returns the URL the user should be redirected to after auth.
   */
  async handleCallback(code: string): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Strava OAuth not configured');
    }

    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data = (await tokenRes.json()) as StravaTokenResponse;
    if (!data.access_token) {
      throw new BadRequestException('Failed to obtain Strava access token');
    }

    // Upsert: delete the existing token row for this athlete then insert fresh.
    // Using two statements to stay compatible with the Drizzle postgres-js
    // driver (which doesn't support ON CONFLICT DO UPDATE with compound keys
    // in all Drizzle versions).
    const athleteId = String(data.athlete.id);
    await this.db.delete(stravaTokens).where(eq(stravaTokens.athleteId, athleteId));
    await this.db.insert(stravaTokens).values({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at,
      athleteId,
    });

    return process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
  }

  // ---------------------------------------------------------------------------
  // Activity sync — manual trigger + scheduled daily run
  // ---------------------------------------------------------------------------

  /**
   * Fetches up to 200 activities from Strava, then fetches GPS streams for
   * any activity that doesn't already have coordinates.
   * Returns a structured result so the controller can shape the HTTP response.
   *
   * startDate/endDate (when given) are sent as `after`/`before` epoch-second
   * params, restricting the fetch to a date range for manual backfill syncs.
   */
  async syncActivities(
    startDate?: string,
    endDate?: string,
  ): Promise<StravaSyncResult | { error: string }> {
    const accessToken = await this.getToken();
    if (!accessToken) return { error: 'Strava not connected' };

    const url = new URL(`${STRAVA_API}/athlete/activities`);
    url.searchParams.set('per_page', '200');
    if (startDate) url.searchParams.set('after', String(toEpochSeconds(startDate, 'start')));
    if (endDate) url.searchParams.set('before', String(toEpochSeconds(endDate, 'end')));

    const activitiesRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!activitiesRes.ok) {
      return { error: `Strava API error: ${activitiesRes.status}` };
    }

    const activities = (await activitiesRes.json()) as StravaActivityRaw[];

    // Single SELECT fetches all existing rows — avoids N+1 per activity.
    const existing = await this.db
      .select({ stravaId: stravaActivities.stravaId, coords: stravaActivities.coords })
      .from(stravaActivities);
    const existingMap = new Map(existing.map((r) => [String(r.stravaId), r.coords]));

    const hikes = await this.hikesService.getClassifiable();
    let synced = 0;
    let discarded = 0;
    for (const act of activities) {
      const existingCoords = existingMap.get(String(act.id));
      // Skip if we already have non-empty GPS data for this activity.
      if (existingCoords != null && existingCoords !== '[]') continue;

      const coords = await this.fetchActivityCoords(act.id, accessToken);

      if (existingMap.has(String(act.id))) {
        // Activity exists but was missing GPS — backfill coords only, keep its existing hike.
        await this.db
          .update(stravaActivities)
          .set({ coords: JSON.stringify(coords) })
          .where(eq(stravaActivities.stravaId, act.id));
        synced++;
        continue;
      }

      const [repLat, repLon] = coords[0] ?? [null, null];
      const result = this.classifier.classify(act.start_date, repLat, repLon, hikes);
      if (!result) {
        discarded++;
        continue;
      }
      if (result.nearMisses.length > 0) {
        this.logger.warn(
          `Activity ${act.id} (${act.start_date}) assigned to hike ${result.hikeId}, near-missed hike(s) [${result.nearMisses.join(', ')}]`,
        );
      }

      await this.db.insert(stravaActivities).values({
        hikeId: result.hikeId,
        stravaId: act.id,
        name: act.name,
        type: act.type,
        distance: act.distance,
        movingTime: act.moving_time,
        elevationGain: act.total_elevation_gain || 0,
        startDate: act.start_date,
        coords: JSON.stringify(coords),
      });
      synced++;
    }

    if (discarded > 0) {
      this.addSyncLog(`${discarded} activity(ies) discarded — no hike's date range covers their start date`);
    }

    const pruned = await this.pruneOutsidePeriods();

    const [{ total }] = await this.db.select({ total: count() }).from(stravaActivities);
    // node-postgres returns COUNT(*)/bigint as a string at runtime despite Drizzle's `number` type.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
    return { synced, pruned, total: Number(total) };
  }

  /**
   * Runs every day at midnight.
   * Errors are logged and swallowed — a failed sync should not surface as an
   * unhandled rejection that could destabilise the process.
   */
  @Cron('0 0 * * *')
  async autoSync(): Promise<void> {
    if (!this.clientId || !this.clientSecret) return;
    try {
      const result = await this.syncActivities();
      if ('error' in result) {
        this.logger.warn(`Daily Strava sync skipped: ${result.error}`);
        this.addSyncLog(`Skipped: ${result.error}`);
      } else if (result.synced > 0 || result.pruned > 0) {
        const prunedLabel = result.pruned > 0 ? `, ${result.pruned} pruned (outside sync periods)` : '';
        this.logger.log(`Daily Strava sync: ${result.synced} new activities${prunedLabel}`);
        this.addSyncLog(`${result.synced} new activities synced${prunedLabel}`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Daily Strava sync error: ${msg}`);
      this.addSyncLog(`Error: ${msg}`);
    }
  }

  private addSyncLog(message: string): void {
    this.syncLogs.unshift({ source: 'strava', time: new Date().toISOString(), message });
    if (this.syncLogs.length > 50) this.syncLogs.length = 50;
  }

  /**
   * Deletes previously-synced activities whose start date falls outside
   * every configured sync period. No-op when no periods are configured, so
   * syncing stays unrestricted until the admin opts in.
   */
  private async pruneOutsidePeriods(): Promise<number> {
    const periods = await this.syncPeriodsService.getAll();
    if (periods.length === 0) return 0;

    const rows = await this.db
      .select({ id: stravaActivities.id, startDate: stravaActivities.startDate })
      .from(stravaActivities);

    const staleIds = rows
      .filter((r) => !r.startDate || !SyncPeriodsService.isWithinPeriods(r.startDate, periods))
      .map((r) => r.id);
    if (staleIds.length === 0) return 0;

    await this.db.delete(stravaActivities).where(inArray(stravaActivities.id, staleIds));
    return staleIds.length;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns a valid access token, refreshing it proactively when it is within
   * REFRESH_BUFFER_S seconds of expiry. Concurrent calls are coalesced into a
   * single refresh request.
   */
  private async getToken(): Promise<string | null> {
    const rows = await this.db.select().from(stravaTokens).limit(1);
    if (rows.length === 0) return null;

    const token = rows[0];
    const nowS = Math.floor(Date.now() / 1000);

    if (token.expiresAt >= nowS + REFRESH_BUFFER_S) {
      return token.accessToken;
    }

    // Token is expiring — refresh, coalescing any concurrent requests.
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        if (!this.clientId || !this.clientSecret) return null;

        const res = await fetch(STRAVA_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
          }),
        });

        const data = (await res.json()) as StravaRefreshResponse;
        if (!data.access_token) return null;

        await this.db
          .update(stravaTokens)
          .set({
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? token.refreshToken,
            expiresAt: data.expires_at ?? token.expiresAt,
          })
          .where(eq(stravaTokens.id, token.id));

        return data.access_token;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /** Fetches the latlng GPS stream for a single activity. Returns [] on any error. */
  private async fetchActivityCoords(
    activityId: number,
    accessToken: string,
  ): Promise<[number, number][]> {
    try {
      const res = await fetch(
        `${STRAVA_API}/activities/${activityId}/streams?keys=latlng&key_by_type=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as StravaStreamResponse;
      return data.latlng?.data ?? [];
    } catch {
      return [];
    }
  }
}
