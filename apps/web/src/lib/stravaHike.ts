import type { StravaActivity } from '../types';
import type { SyncPeriod } from '../api/syncPeriods';
import { HIKE_START, HIKE_END } from './constants';
import { isWithinPeriods } from './tripDays';

/**
 * Strava activities that count as trail hiking — type 'Hike', within the
 * configured admin sync periods (falling back to the hardcoded hike window
 * when none are set yet). Strava also logs rides/runs/swims etc. year-round
 * that shouldn't feed into trail distance stats.
 */
export function filterHikeActivities(stravaActivities: StravaActivity[], periods: SyncPeriod[]): StravaActivity[] {
  return stravaActivities.filter(a => {
    if (a.type !== 'Hike' || a.startDate == null) return false;
    return periods.length > 0
      ? isWithinPeriods(a.startDate, periods)
      : a.startDate.slice(0, 10) >= HIKE_START && a.startDate.slice(0, 10) <= HIKE_END;
  });
}

export function sumHikeDistanceKm(hikeActivities: StravaActivity[]): number {
  return hikeActivities.reduce((sum, a) => sum + (a.distance ?? 0) / 1000, 0);
}
