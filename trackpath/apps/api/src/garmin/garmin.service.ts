import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { asc, desc, not, like, count, eq, gte } from 'drizzle-orm';
import { parseString } from 'xml2js';
import { Subject, Observable, from, startWith, switchMap, map } from 'rxjs';
import { trackingPoints } from '@trackpath/db/schema';
import type { NewTrackingPoint, TrackingPoint } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import { TRIP_START } from '../constants.js';
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

const MAPSHARE_BASE = 'https://share.garmin.com/Feed/Share';
const INTERVAL_NAME = 'garmin-auto-sync';

@Injectable()
export class GarminService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GarminService.name);

  private readonly mapshareId: string | null;
  private readonly pollIntervalMs: number;

  private lastSyncStatus: SyncStatus = { time: null, newCount: 0, error: null };
  private readonly syncLogs: SyncLog[] = [];
  private readonly pointsChanged$ = new Subject<void>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
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

    // Register with SchedulerRegistry so the interval is visible to NestJS
    // diagnostics and is cleaned up correctly on shutdown.
    const interval = setInterval(() => void this.autoSync(), this.pollIntervalMs);
    this.schedulerRegistry.addInterval(INTERVAL_NAME, interval);

    // Fire an initial sync immediately rather than waiting for the first tick.
    void this.autoSync();

    this.logger.log(
      `Auto-sync started: every ${this.pollIntervalMs / 60_000} min (mapshareId=${this.mapshareId})`,
    );
  }

  onModuleDestroy(): void {
    try {
      this.schedulerRegistry.deleteInterval(INTERVAL_NAME);
    } catch {
      // Interval was never registered (MAPSHARE_ID absent) — nothing to clean up.
    }
  }

  // ---------------------------------------------------------------------------
  // Public query methods
  // ---------------------------------------------------------------------------

  getAllPoints(): Promise<TrackingPoint[]> {
    return this.db
      .select()
      .from(trackingPoints)
      .where(gte(trackingPoints.timestamp, TRIP_START))
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

  /** SSE stream: emits all points on connect and after each sync that adds new points. */
  getPointsStream(): Observable<{ data: TrackingPoint[] }> {
    return this.pointsChanged$.pipe(
      startWith(undefined),
      switchMap(() => from(this.getAllPoints())),
      map(points => ({ data: points })),
    );
  }

  /** Builds a GPX 1.1 XML string from all tracking points. */
  buildGpx(points: TrackingPoint[]): string {
    const trkpts = points
      .map(p => `    <trkpt lat="${p.latitude}" lon="${p.longitude}">
      <ele>${p.altitude ?? 0}</ele>
      <time>${new Date(p.timestamp).toISOString()}</time>
    </trkpt>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="trackpath" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Appalachian Trail</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }

  // ---------------------------------------------------------------------------
  // Manual point CRUD
  // ---------------------------------------------------------------------------

  async addManualPoint(body: ManualPointBody): Promise<TrackingPoint> {
    this.validateManualPointBody(body);

    const point: NewTrackingPoint = {
      garminId: `manual-${Date.now()}`,
      latitude: body.latitude,
      longitude: body.longitude,
      altitude: body.altitude ?? null,
      timestamp: new Date().toISOString(),
      velocity: null,
      course: null,
      message: body.message ?? null,
      eventType: body.tag ?? 'manual',
    };

    const [inserted] = await this.db.insert(trackingPoints).values(point).returning();
    this.pointsChanged$.next();
    return inserted;
  }

  async deletePoint(id: number): Promise<void> {
    await this.db.delete(trackingPoints).where(eq(trackingPoints.id, id));
    this.pointsChanged$.next();
  }

  // ---------------------------------------------------------------------------
  // MapShare sync
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
    if (newCount > 0) this.pointsChanged$.next();
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
        this.pointsChanged$.next();
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
   * Fetches the MapShare KML feed with a 30 s AbortController timeout.
   *
   * Timestamp rule: "Time UTC" from the device is the canonical timestamp.
   * The device clock reflects when the GPS fix was recorded, not when the
   * satellite uplink delivered it — critical for correct track ordering when
   * points arrive in bursts after connectivity gaps.
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

    return this.extractPoints(await this.parseKml(xml));
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
      if (!coords) continue;

      const [lng, lat, alt] = coords.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) continue;

      const ext = this.normaliseExtData(pm);

      const elevation = ext['Elevation'] != null ? parseFloat(ext['Elevation']) : null;
      const finalAlt = alt != null && !isNaN(alt) ? alt : elevation;
      const timestamp = ext['Time UTC'] ?? new Date().toISOString();
      const garminId = ext['Id'] ?? `${lat}-${lng}-${timestamp}`;

      const messageText = ext['Text'] ?? pm.description ?? null;
      const eventType = /poop/i.test(messageText ?? '')
        ? 'poop'
        : (ext['Event'] ?? null);

      points.push({
        garminId,
        latitude: lat,
        longitude: lng,
        altitude: finalAlt,
        timestamp,
        velocity: ext['Velocity'] != null ? parseFloat(ext['Velocity']) : null,
        course: ext['Course'] != null ? parseFloat(ext['Course']) : null,
        message: messageText,
        eventType,
      });
    }

    return points;
  }

  private normaliseExtData(pm: KmlPlacemark): GarminExtData {
    const ext: GarminExtData = {};
    if (!pm.ExtendedData?.Data) return ext;

    const entries: KmlDataEntry[] = Array.isArray(pm.ExtendedData.Data)
      ? pm.ExtendedData.Data
      : [pm.ExtendedData.Data];

    for (const d of entries) ext[d.$.name] = d.value;
    return ext;
  }

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
    ) throw new BadRequestException('Invalid latitude/longitude');
    if (altitude != null && typeof altitude !== 'number')
      throw new BadRequestException('altitude must be a number');
    if (message != null && typeof message !== 'string')
      throw new BadRequestException('message must be a string');
    if (tag != null && typeof tag !== 'string')
      throw new BadRequestException('tag must be a string');
  }
}
