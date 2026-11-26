import { stravaActivities } from '@trackpath/db/schema';
import type { DrizzleClient } from '../../database/drizzle.types.js';
import { DistanceFacts } from './distance.facts.js';

/** Stubs the DB at its edge: select().from(table).where() resolves to that table's rows. */
function makeFacts(points: object[], activities: object[]): DistanceFacts {
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(table === stravaActivities ? activities : points),
      }),
    }),
  };
  return new DistanceFacts(db as unknown as DrizzleClient);
}

// 0.01 deg of latitude is ~1.112 km.
const pt = (timestamp: string, latitude: number) => ({ timestamp, latitude, longitude: 10 });

describe('DistanceFacts', () => {
  it('sums Strava activity distances (meters -> km) when any exist in the window', async () => {
    const facts = makeFacts(
      [pt('2026-06-01T12:00:00.000Z', 10), pt('2026-06-01T13:00:00.000Z', 10.5)],
      [
        { distance: 10000, startDate: '2026-06-01T12:00:00Z' },
        { distance: 2500, startDate: '2026-06-01T15:00:00Z' },
      ],
    );
    expect(await facts.getDistanceKm(1, '2026-06-01')).toBeCloseTo(12.5, 5);
  });

  it('ignores Strava activities outside the New York day and falls back to Garmin', async () => {
    const facts = makeFacts(
      [pt('2026-06-01T12:00:00.000Z', 10), pt('2026-06-01T13:00:00.000Z', 10.01)],
      // 2026-06-01T04:00Z is NY midnight (EDT); 03:59Z is the previous NY day.
      [{ distance: 9000, startDate: '2026-06-01T03:59:00Z' }],
    );
    expect(await facts.getDistanceKm(1, '2026-06-01')).toBeCloseTo(1.112, 2);
  });

  it('falls back to summed consecutive Garmin points, in device-time order', async () => {
    const facts = makeFacts(
      [
        pt('2026-06-01T14:00:00.000Z', 10.02),
        pt('2026-06-01T12:00:00.000Z', 10),
        pt('2026-06-01T13:00:00.000Z', 10.01),
      ],
      [],
    );
    expect(await facts.getDistanceKm(1, '2026-06-01')).toBeCloseTo(2.224, 2);
  });

  it('excludes points before midnight and after 21:00 New York (01:00Z next day in EDT)', async () => {
    const facts = makeFacts(
      [
        pt('2026-06-01T03:59:59.000Z', 9), // previous NY day
        pt('2026-06-01T12:00:00.000Z', 10),
        pt('2026-06-01T12:30:00.000Z', 10.01),
        pt('2026-06-02T01:00:01.000Z', 11), // 21:00:01 NY, late
      ],
      [],
    );
    expect(await facts.getDistanceKm(1, '2026-06-01')).toBeCloseTo(1.112, 2);
  });

  it('uses the EST offset in winter (21:00 NY is 02:00Z)', async () => {
    const facts = makeFacts(
      [
        pt('2026-01-10T12:00:00.000Z', 10),
        pt('2026-01-11T01:30:00.000Z', 10.01), // 20:30 NY, in
        pt('2026-01-11T02:30:00.000Z', 10.5), // 21:30 NY, out
      ],
      [],
    );
    expect(await facts.getDistanceKm(1, '2026-01-10')).toBeCloseTo(1.112, 2);
  });

  it('returns 0 with no data or a single point', async () => {
    expect(await makeFacts([], []).getDistanceKm(1, '2026-06-01')).toBe(0);
    expect(await makeFacts([pt('2026-06-01T12:00:00.000Z', 10)], []).getDistanceKm(1, '2026-06-01')).toBe(0);
  });
});
