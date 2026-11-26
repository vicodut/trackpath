import { Injectable, Inject } from '@nestjs/common';
import { and, eq, gte, lte } from 'drizzle-orm';
import { stravaActivities, trackingPoints } from '@trackpath/db/schema';
import { DRIZZLE } from '../../database/drizzle.constants.js';
import type { DrizzleClient } from '../../database/drizzle.types.js';
import { haversineKm } from '../../common/geo.util.js';

const TZ = 'America/New_York';
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC epoch ms of the given wall-clock time in America/New_York (DST-aware). */
function newYorkWallToEpoch(date: string, hour: number): number {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  const offsetAt = (t: number): number => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric',
        day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
      }).formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]),
    );
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  };
  // Second pass settles the offset when the first guess straddles a DST change.
  return wall - offsetAt(wall - offsetAt(wall));
}

/**
 * Distance walked for a hike on one day. The day is midnight to 21:00
 * America/New_York, judged by device timestamps (never server arrival time);
 * later points are excluded. Uses the sum of that window's Strava activities
 * when there are any, otherwise the Garmin track length. Never syncs Strava.
 */
@Injectable()
export class DistanceFacts {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  /** Kilometers walked on `day` (YYYY-MM-DD, New York calendar day) for the hike. */
  async getDistanceKm(hikeId: number, day: string): Promise<number> {
    const start = newYorkWallToEpoch(day, 0);
    const end = newYorkWallToEpoch(day, 21);
    const inWindow = (iso: string | null): boolean => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= start && t <= end;
    };
    // Timestamps are text; pad the string bounds by a day (format/precision
    // differences) and do the exact comparison on parsed instants below.
    const lo = new Date(start - DAY_MS).toISOString();
    const hi = new Date(end + DAY_MS).toISOString();

    const activities = (await this.db
      .select({ distance: stravaActivities.distance, startDate: stravaActivities.startDate })
      .from(stravaActivities)
      .where(and(eq(stravaActivities.hikeId, hikeId), gte(stravaActivities.startDate, lo), lte(stravaActivities.startDate, hi))))
      .filter((a) => inWindow(a.startDate));
    if (activities.length > 0) {
      return activities.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000; // Strava meters -> km
    }

    const points = (await this.db
      .select({ timestamp: trackingPoints.timestamp, latitude: trackingPoints.latitude, longitude: trackingPoints.longitude })
      .from(trackingPoints)
      .where(and(eq(trackingPoints.hikeId, hikeId), gte(trackingPoints.timestamp, lo), lte(trackingPoints.timestamp, hi))))
      .filter((p) => inWindow(p.timestamp))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let km = 0;
    for (let i = 1; i < points.length; i++) {
      km += haversineKm(points[i - 1].latitude, points[i - 1].longitude, points[i].latitude, points[i].longitude);
    }
    return km;
  }
}
