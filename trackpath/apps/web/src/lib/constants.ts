export const TAG_EMOJIS: Record<string, string> = {
  poop: '💩',
  resupply: '🛒',
  hostel: '🏠',
  camp: '⛺',
  shelter: '🛖',
  water: '💧',
  viewpoint: '👀',
};

export const TAGS = ['resupply', 'poop', 'hostel', 'camp', 'shelter', 'water', 'viewpoint'] as const;

export const MOBILE_BREAKPOINT = 768;

/** Trip start date — all points and activities before this are filtered out. */
export const TRIP_START = new Date('2026-04-15T00:00:00Z');

/**
 * Hike window (YYYY-MM-DD, inclusive) used to filter which Strava
 * activities count as trail distance — Strava also logs rides/runs/swims
 * etc. (year-round, before and after the hike) that shouldn't feed into
 * trail distance/progress stats.
 */
export const HIKE_START = TRIP_START.toISOString().slice(0, 10);
export const HIKE_END = '2026-07-13';
