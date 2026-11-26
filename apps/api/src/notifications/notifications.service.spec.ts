import { Test } from '@nestjs/testing';
import type { DailyFacts } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import { HikesService } from '../hikes/hikes.service.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER } from './notifications.types.js';

/**
 * In-memory stand-in for the Drizzle chains the service uses. Ignores predicates: tests use one hike.
 * The real unique constraint is covered by notifications.integration.spec.ts.
 */
function fakeDb() {
  const rows: Record<string, unknown>[] = [];
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows.slice(0, 1)) }) }) }),
    update: () => ({
      set: (v: Record<string, unknown>) => ({
        where: () => {
          Object.assign(rows[0] ?? {}, v);
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            if (rows.length > 0) return Promise.resolve([]);
            const stored = { id: 1, delivered: false, ...row };
            rows.push(stored);
            return Promise.resolve([stored]);
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
  const state = { dispatchFails: false };
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
      {
        provide: DISPATCHER,
        useValue: {
          dispatch: () => {
            calls.push('dispatch');
            return state.dispatchFails ? Promise.reject(new Error('down')) : Promise.resolve();
          },
        },
      },
    ],
  }).compile();
  return { service: module.get(NotificationsService), rows, calls, state };
}

const NOW = new Date('2026-06-10T08:00:00Z');

describe('NotificationsService', () => {
  it('runs gather, build, then dispatch in order and stores one delivered row', async () => {
    const { service, rows, calls } = await setup();
    await service.runDailyUpdate(NOW);
    expect(calls).toEqual(['gather', 'build', 'dispatch']);
    expect(rows).toEqual([
      expect.objectContaining({ hikeId: 1, date: '2026-06-10', text: 'hi', fallback: false, delivered: true }),
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

  it('re-dispatches a saved but undelivered row without gathering again', async () => {
    const { service, rows, calls, state } = await setup();
    state.dispatchFails = true;
    await expect(service.runDailyUpdate(NOW)).rejects.toThrow('down');
    expect(rows[0]).toMatchObject({ delivered: false });
    calls.length = 0;
    state.dispatchFails = false;
    await service.onApplicationBootstrap();
    expect(calls).toEqual(['dispatch']);
    expect(rows[0]).toMatchObject({ delivered: true });
  });

  it('uses the New York date: 00:30 UTC on the 26th is still the 25th', async () => {
    const { service, rows } = await setup();
    await service.runDailyUpdate(new Date('2026-06-26T00:30:00Z'));
    expect(rows[0]).toMatchObject({ date: '2026-06-25' });
  });
});
