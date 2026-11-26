import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '@trackpath/db/schema';
import { hikes, notifications } from '@trackpath/db/schema';
import type { DailyFacts } from '@trackpath/db/schema';

/**
 * Real-database check of the unique (hike, date) constraint. Runs only when
 * TEST_DATABASE_URL points at a migrated Postgres (`DATABASE_URL=... npm run migrate`).
 */
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('notifications unique (hike, date) constraint', () => {
  const sql = postgres(url ?? 'postgres://unused');
  const db = drizzle(sql, { schema });
  let hikeId: number;
  const facts: DailyFacts = { hikeId: 0, date: '2026-06-10', distanceKmToday: null };

  beforeAll(async () => {
    const created = await db
      .insert(hikes)
      .values({
        slug: `it-notifications-${Date.now()}`,
        name: 'Integration hike',
        startDate: '2026-06-01',
        trailCoords: '[]',
        elevationProfile: '[]',
        distanceKm: 1,
      })
      .returning({ id: hikes.id });
    hikeId = created[0].id;
  });

  afterAll(async () => {
    await db.delete(hikes).where(eq(hikes.id, hikeId)); // cascades to notifications
    await sql.end();
  });

  it('rejects a second row for the same hike and date', async () => {
    const row = { hikeId, date: '2026-06-10', facts, text: 'first' };
    await db.insert(notifications).values(row);
    await expect(db.insert(notifications).values({ ...row, text: 'second' })).rejects.toThrow();
    const again = await db.insert(notifications).values(row).onConflictDoNothing().returning();
    expect(again).toEqual([]);
    const stored = await db.select().from(notifications).where(eq(notifications.hikeId, hikeId));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ text: 'first', delivered: false });
  });
});
