import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Inject, Injectable } from '@nestjs/common';
import { desc, lte } from 'drizzle-orm';
import { trackingPoints } from '@trackpath/db/schema';
import { DRIZZLE } from '../../database/drizzle.constants.js';
import type { DrizzleClient } from '../../database/drizzle.types.js';

interface TrailSample { lat: number; lon: number; distanceKm: number }
interface Highlight { name: string; lat: number; lon: number }

// The JSON lives in apps/web/public and the Dockerfile copies it to the same
// relative spot in the runtime image; src/ and dist/ share this depth.
// shortcut: no API-side static-data precedent, so a lazy sync relative read; extract a shared loader if a second consumer appears.
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../web/public');
const readPublicJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(PUBLIC_DIR, file), 'utf8'));

/** Same formula as apps/web/src/lib/geo.ts so snapping matches the frontend. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** UTC ISO instant of 21:00 America/New_York on the given YYYY-MM-DD (DST-aware). */
function cutoffIso(date: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
  const midnightUtc = Date.parse(`${date}T00:00:00.000Z`);
  // New York is UTC-4 (EDT) or UTC-5 (EST); keep whichever offset shows 21:00 locally.
  for (const offsetH of [4, 5]) {
    const d = new Date(midnightUtc + (21 + offsetH) * 3_600_000);
    if (fmt.format(d) === '21') return d.toISOString();
  }
  return `${date}T23:59:59.999Z`;
}

/** Daily-update facts: overall trail progress and nearest highlight. Emits no coordinates. */
@Injectable()
export class TrailProgressFacts {
  private trail?: TrailSample[];
  private highlights?: Highlight[];

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  /** Facts for the day's latest fix by device timestamp (up to 21:00 New York); empty when none. */
  async getFacts(date: string): Promise<string[]> {
    const [fix] = await this.db
      .select({ latitude: trackingPoints.latitude, longitude: trackingPoints.longitude })
      .from(trackingPoints)
      .where(lte(trackingPoints.timestamp, cutoffIso(date)))
      .orderBy(desc(trackingPoints.timestamp))
      .limit(1);
    if (!fix) return [];

    this.trail ??= readPublicJson('at-trail-elevation.json') as TrailSample[];
    this.highlights ??= readPublicJson('at-highlights.json') as Highlight[];
    const { latitude: lat, longitude: lon } = fix;

    // Strict < and first-wins, identical to the frontend's findClosestTrailIndex.
    let best = this.trail[0];
    let bestD = Infinity;
    for (const s of this.trail) {
      const d = haversine(lat, lon, s.lat, s.lon);
      if (d < bestD) { bestD = d; best = s; }
    }
    const total = this.trail[this.trail.length - 1].distanceKm;
    const out = [`Trail progress: ${Math.round(best.distanceKm)} km of ${Math.round(total)} km`];

    let near: Highlight | undefined;
    let nearD = Infinity;
    for (const h of this.highlights) {
      const d = haversine(lat, lon, h.lat, h.lon);
      if (d < nearD) { nearD = d; near = h; }
    }
    if (near) {
      out.push(`Nearest highlight: ${nearD < 0.5 ? 'at' : `about ${Math.round(nearD)} km from`} ${near.name}`);
    }
    return out;
  }
}
