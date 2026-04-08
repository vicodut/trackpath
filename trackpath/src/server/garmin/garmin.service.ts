import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { asc, desc, not, like, count, eq } from 'drizzle-orm';
import { parseString } from 'xml2js';
import { trackingPoints } from '../../db/schema.js';
import type { NewTrackingPoint, TrackingPoint } from '../../db/schema.js';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type {
  GarminExtData,
  KmlDataEntry,
  KmlPlacemark,
  KmlRoot,
  ManualPointBody,
  SyncLog,
  SyncStatus,
} from './garmin.types.js';

/** Fetch timeout for spotty satellite connectivity (30 s). */
const FETCH_TIMEOUT_MS = 30_000;

/** Garmin MapShare KML feed base URL. */
const MAPSHARE_BASE = 'https://share.garmin.com/Feed/Share';

@Injectable()
export class GarminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GarminService.name);

  private readonly mapshareId: string | null;
  private readonly pollIntervalMs: number;

  private pollTimer: NodeJS.Timeout | null = null;

  private lastSyncStatus: SyncStatus = { time: null, newCount: 0, error: null };
  private readonly syncLogs: SyncLog[] = [];

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {
    this.mapshareId = process.env.MAPSHARE_ID ?? null;
    this.pollIntervalMs =
      (parseInt(process.env.POLL_INTERVAL_MIN ?? '5', 10) || 5) * 60_000;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onModuleInit(): void {
    if (!this.mapshareId) {
      this.logger.warn('MAPSHARE_ID not set — auto-sync disabled');
      return;
    }
    // Fire an initial sync, then repeat on the configured interval.
    void this.autoSync();
    this.pollTimer = setInterval(() => void this.autoSync(), this.pollIntervalMs);
    this.logger.log(
      `Auto-sync started: every ${this.pollIntervalMs / 60_000} min (mapshareId=${this.mapshareId})`,
    );
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Public query methods
  // ---------------------------------------------------------------------------

  getAllPoints(): Promise<TrackingPoint[]> {
    return this.db
      .select()
      .from(trackingPoints)
      .orderBy(asc(trackingPoints.timestamp));
  }

  async getLastGarminPoint(): Promise<TrackingPoint | null> {
    const rows = await this.db
      .select()
      .from(trackingPoints)
      .where(not(like(trackingPoints.garminId, 'manual-%')))
      .orderBy(desc(trackingPoints.timestamp))
      .limit(1);
    return rows[0] ?? null;
  }

  async countPoints(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(trackingPoints);
    return Number(row?.total ?? 0);
  }

  getSyncStatus(): SyncStatus & { pollIntervalMin: number; mapshareConfigured: boolean } {
    return {
      ...this.lastSyncStatus,
      pollIntervalMin: this.pollIntervalMs / 60_000,
      mapshareConfigured: !!this.mapshareId,
    };
  }

  getSyncLogs(): SyncLog[] {
    return this.syncLogs;
  }

  // ---------------------------------------------------------------------------
  // Manual point creation
  // ---------------------------------------------------------------------------

  async addManualPoint(body: ManualPointBody): Promise<TrackingPoint> {
    this.validateManualPointBody(body);

    const point: NewTrackingPoint = {
      // Prefix "manual-" lets the rest of the app distinguish device vs user points.
      garminId: `manual-${Date.now()}`,
      latitude: body.latitude,
      longitude: body.longitude,
      altitude: body.altitude ?? null,
      // Use server time for manual points — there is no device timestamp.
      timestamp: new Date().toISOString(),
      velocity: null,
      course: null,
      message: body.message ?? null,
      eventType: body.tag ?? 'manual',
    };

    const [inserted] = await this.db
      .insert(trackingPoints)
      .values(point)
      .returning();

    return inserted;
  }

  async deletePoint(id: number): Promise<void> {
    await this.db.delete(trackingPoints).where(eq(trackingPoints.id, id));
  }

  // ---------------------------------------------------------------------------
  // MapShare sync (called by controller and by the auto-poll timer)
  // ---------------------------------------------------------------------------

  async syncFromMapShare(): Promise<{ synced: number; total: number; points: TrackingPoint[] }> {
    if (!this.mapshareId) {
      throw new BadRequestException('MAPSHARE_ID environment variable not set');
    }

    let fetched: NewTrackingPoint[];
    try {
      fetched = await this.fetchGarminPoints(this.mapshareId);
    } catch (err) {
      const msg = (err as Error).message;
      this.addSyncLog(`Manual sync error: ${msg}`);
      throw new InternalServerErrorException(msg);
    }

    const newCount = await this.insertPoints(fetched);
    const all = await this.getAllPoints();

    this.addSyncLog(`Manual sync: ${newCount} new points (${all.length} total)`);
    return { synced: newCount, total: all.length, points: all };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async autoSync(): Promise<void> {
    if (!this.mapshareId) return;

    try {
      const fetched = await this.fetchGarminPoints(this.mapshareId);
      const newCount = await this.insertPoints(fetched);

      this.lastSyncStatus = { time: new Date().toISOString(), newCount, error: null };

      if (newCount > 0) {
        this.logger.log(`Auto-sync: ${newCount} new points`);
        this.addSyncLog(`${newCount} new points synced`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      this.lastSyncStatus = { time: new Date().toISOString(), newCount: 0, error: msg };
      // Log but do not throw — spotty connectivity must not crash the poll loop.
      this.logger.error(`Auto-sync error: ${msg}`);
      this.addSyncLog(`Error: ${msg}`);
    }
  }

  /**
   * Fetches the Garmin MapShare KML feed and converts placemarks into
   * NewTrackingPoint rows.
   *
   * Connectivity rules:
   *  - Hard timeout of 30 s via AbortController; the satellite link can stall.
   *  - Non-2xx responses are treated as transient errors and propagated to the
   *    caller, which decides whether to log-and-continue (auto-sync) or 500
   *    (manual sync).
   *
   * Timestamp rule:
   *  - The device-assigned "Time UTC" field is the canonical timestamp. The
   *    device clock is accurate even when the satellite uplink is delayed, so
   *    it correctly reflects when the fix was recorded — not when it arrived.
   *    We only fall back to the server clock when the field is absent, which
   *    should never happen in practice.
   */
  private async fetchGarminPoints(mapshareId: string): Promise<NewTrackingPoint[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let xml: string;
    try {
      const res = await fetch(`${MAPSHARE_BASE}/${mapshareId}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Garmin feed returned HTTP ${res.status}`);
      xml = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const kml = await this.parseKml(xml);
    return this.extractPoints(kml);
  }

  private parseKml(xml: string): Promise<KmlRoot> {
    return new Promise((resolve, reject) => {
      parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) return reject(err);
        resolve(result as KmlRoot);
      });
    });
  }

  private extractPoints(kml: KmlRoot): NewTrackingPoint[] {
    const doc = kml?.kml?.Document;
    if (!doc) return [];

    let placemarks: KmlPlacemark | KmlPlacemark[] | undefined =
      doc.Folder?.Placemark ?? doc.Placemark;
    if (!placemarks) return [];
    if (!Array.isArray(placemarks)) placemarks = [placemarks];

    const points: NewTrackingPoint[] = [];

    for (const pm of placemarks) {
      const coords = pm.Point?.coordinates;
      if (!coords) continue; // placemark has no GPS fix — skip

      const [lng, lat, alt] = coords.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) continue;

      const ext = this.normaliseExtData(pm);

      // Altitude: prefer the coordinate triple value; fall back to the
      // explicit Elevation field (some firmware versions omit it from coords).
      const elevation = ext['Elevation'] != null ? parseFloat(ext['Elevation']) : null;
      const finalAlt = alt != null && !isNaN(alt) ? alt : elevation;

      // Canonical timestamp comes from the device clock ("Time UTC").
      // See fetchGarminPoints JSDoc for the rationale.
      const timestamp = ext['Time UTC'] ?? new Date().toISOString();

      // Garmin assigns a unique Id per transmission; use it as the idempotency
      // key. The composite fallback handles old firmware that omits the field.
      const garminId = ext['Id'] ?? `${lat}-${lng}-${timestamp}`;

      points.push({
        garminId,
        latitude: lat,
        longitude: lng,
        altitude: finalAlt,
        timestamp,
        velocity: ext['Velocity'] != null ? parseFloat(ext['Velocity']) : null,
        course: ext['Course'] != null ? parseFloat(ext['Course']) : null,
        message: ext['Text'] ?? pm.description ?? null,
        eventType: ext['Event'] ?? null,
      });
    }

    return points;
  }

  /** Flatten xml2js Data array (or single node) into a plain key→value map. */
  private normaliseExtData(pm: KmlPlacemark): GarminExtData {
    const ext: GarminExtData = {};
    if (!pm.ExtendedData?.Data) return ext;

    const entries: KmlDataEntry[] = Array.isArray(pm.ExtendedData.Data)
      ? pm.ExtendedData.Data
      : [pm.ExtendedData.Data];

    for (const d of entries) {
      ext[d.$.name] = d.value;
    }
    return ext;
  }

  /** Batch-insert; duplicate garminIds are silently skipped (idempotent). */
  private async insertPoints(points: NewTrackingPoint[]): Promise<number> {
    if (points.length === 0) return 0;
    const inserted = await this.db
      .insert(trackingPoints)
      .values(points)
      .onConflictDoNothing()
      .returning({ id: trackingPoints.id });
    return inserted.length;
  }

  private addSyncLog(message: string): void {
    this.syncLogs.unshift({ source: 'garmin', time: new Date().toISOString(), message });
    if (this.syncLogs.length > 50) this.syncLogs.length = 50;
  }

  private validateManualPointBody(body: ManualPointBody): void {
    const { latitude, longitude, altitude, message, tag } = body;

    if (
      typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      throw new BadRequestException('Invalid latitude/longitude');
    }
    if (altitude != null && typeof altitude !== 'number') {
      throw new BadRequestException('altitude must be a number');
    }
    if (message != null && typeof message !== 'string') {
      throw new BadRequestException('message must be a string');
    }
    if (tag != null && typeof tag !== 'string') {
      throw new BadRequestException('tag must be a string');
    }
  }
}
