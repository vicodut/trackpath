import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants.js';
import { AppSettingsService } from '../hikes/app-settings.service.js';
import { HikesService } from '../hikes/hikes.service.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER } from './notifications.types.js';

/** Stub of select().from().where().orderBy(): records the clauses, returns canned rows. */
async function setup(defaultHikeId: number | null, rows: Record<string, unknown>[]) {
  const dialect = new PgDialect();
  const seen: { where?: string; orderBy?: string } = {};
  const db = {
    select: () => ({
      from: () => ({
        where: (w: SQL) => {
          seen.where = dialect.sqlToQuery(w).sql;
          return {
            orderBy: (o: SQL) => {
              seen.orderBy = dialect.sqlToQuery(o).sql;
              return Promise.resolve(rows);
            },
          };
        },
      }),
    }),
  };
  const module = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: DRIZZLE, useValue: db },
      { provide: AppSettingsService, useValue: { getDefaultHikeId: () => Promise.resolve(defaultHikeId) } },
      { provide: HikesService, useValue: {} },
      { provide: FACTS_GATHERER, useValue: {} },
      { provide: MESSAGE_BUILDER, useValue: {} },
      { provide: DISPATCHER, useValue: {} },
    ],
  }).compile();
  return { service: module.get(NotificationsService), seen };
}

describe('NotificationsService.getHistory', () => {
  const stored = {
    id: 2,
    hikeId: 7,
    date: '2026-06-11',
    text: 'Day two',
    fallback: true,
    delivered: false,
    facts: { hikeId: 7, date: '2026-06-11', distanceKmToday: 3, lat: 35.1, lon: -83.2 },
    createdAt: new Date(),
  };

  it('queries the default hike only, newest date first', async () => {
    const { service, seen } = await setup(7, [stored]);
    await service.getHistory();
    expect(seen.where).toContain('"hike_id" = $1');
    expect(seen.orderBy).toMatch(/"date" desc/);
  });

  it('returns only date, text, fallback and delivered (no facts, no coordinates)', async () => {
    const { service } = await setup(7, [stored]);
    expect(await service.getHistory()).toEqual([
      { date: '2026-06-11', text: 'Day two', fallback: true, delivered: false },
    ]);
  });

  it('returns an empty list when nothing is stored', async () => {
    const { service } = await setup(7, []);
    expect(await service.getHistory()).toEqual([]);
  });

  it('returns an empty list without querying when no default hike is set', async () => {
    const { service, seen } = await setup(null, [stored]);
    expect(await service.getHistory()).toEqual([]);
    expect(seen.where).toBeUndefined();
  });
});
