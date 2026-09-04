import { Injectable } from '@nestjs/common';
import { haversineKm } from '../common/geo.util.js';
import { toUtcDayStart, toUtcDayEnd } from '../common/date-range.util.js';
import type { ClassifiableHike, ClassificationResult } from './hike-classifier.types.js';

/**
 * Attributes an incoming Garmin point or Strava activity to a hike.
 *
 * Every hike whose [startDate, endDate] covers the event's timestamp is a
 * candidate (an open endDate covers everything from startDate onward). Zero
 * candidates means no hike claims this event — callers must not persist it.
 * One candidate wins outright, even if the event is geographically far from
 * that hike's trail (a town stop / resupply detour is still part of the
 * hike). Multiple candidates (overlapping hikes) are broken by trail
 * proximity; the losing candidate(s) are reported as near-misses for admin
 * review rather than silently dropped.
 */
@Injectable()
export class HikeClassifierService {
  classify(
    timestampIso: string,
    lat: number,
    lon: number,
    hikes: ClassifiableHike[],
  ): ClassificationResult | null {
    const t = new Date(timestampIso).getTime();
    const candidates = hikes.filter((h) => this.isWithinRange(t, h.startDate, h.endDate));

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return { hikeId: candidates[0].id, nearMisses: [] };

    const ranked = candidates
      .map((h) => ({ id: h.id, distanceKm: this.distanceToTrail(lat, lon, h.trailCoords) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return {
      hikeId: ranked[0].id,
      nearMisses: ranked.slice(1).map((r) => r.id),
    };
  }

  private isWithinRange(t: number, startDate: string, endDate: string | null): boolean {
    const start = new Date(toUtcDayStart(startDate)).getTime();
    if (t < start) return false;
    if (endDate == null) return true;
    return t <= new Date(toUtcDayEnd(endDate)).getTime();
  }

  /** Nearest-vertex approximation, matching the existing frontend trail-distance pattern. */
  private distanceToTrail(lat: number, lon: number, trailCoords: [number, number][]): number {
    let best = Infinity;
    for (const [tLat, tLon] of trailCoords) {
      const d = haversineKm(lat, lon, tLat, tLon);
      if (d < best) best = d;
    }
    return best;
  }
}
