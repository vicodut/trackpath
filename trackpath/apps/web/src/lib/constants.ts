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
