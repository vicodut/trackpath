import { Test } from '@nestjs/testing';
import type { DailyFacts } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import { HikesService } from '../hikes/hikes.service.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER } from './notifications.types.js';

/** In-memory stand-in for the two Drizzle chains the service uses. Ignores predicates: tests use one hike. */
function fakeDb() {
  const rows: Record<string, unknown>[] = [];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows.slice(0, 1)) }) }) }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            if (rows.length > 0) return Promise.resolve([]);
            rows.push(row);
            return Promise.resolve([row]);
          },
        }),
      }),
    }),
  };
  return { db, rows };
}

async function setup() {
  const { db, rows } = fakeDb();
  const calls: string[] = [];
  const facts: DailyFacts = { hikeId: 1, date: '2026-06-10', distanceKmToday: 12 };
  const module = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: DRIZZLE, useValue: db },
      {
        provide: HikesService,
        useValue: { getAll: () => Promise.resolve([{ id: 1, startDate: '2026-06-01', endDate: null }]) },
      },
      { provide: FACTS_GATHERER, useValue: { gather: () => { calls.push('gather'); return Promise.resolve(facts); } } },
      { provide: MESSAGE_BUILDER, useValue: { build: () => { calls.push('build'); return Promise.resolve({ text: 'hi', fallback: false }); } } },
      { provide: DISPATCHER, useValue: { dispatch: () => { calls.push('dispatch'); return Promise.resolve(); } } },
    ],
  }).compile();
  return { service: module.get(NotificationsService), rows, calls };
}

const NOW = new Date('2026-06-10T08:00:00Z');

describe('NotificationsService', () => {
  it('runs gather, build, then dispatch in order and stores one row', async () => {
    const { service, rows, calls } = await setup();
    await service.runDailyUpdate(NOW);
    expect(calls).toEqual(['gather', 'build', 'dispatch']);
    expect(rows).toEqual([
      expect.objectContaining({ hikeId: 1, date: '2026-06-10', text: 'hi', fallback: false }),
    ]);
  });

  it('a second run for the same hike and date writes and sends nothing', async () => {
    const { service, rows, calls } = await setup();
    await service.runDailyUpdate(NOW);
    calls.length = 0;
    await service.runDailyUpdate(NOW);
    expect(calls).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("generates today's update on bootstrap when its row is missing", async () => {
    const { service, rows } = await setup();
    await service.onApplicationBootstrap();
    expect(rows).toHaveLength(1);
  });
});
