import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { notifications, stravaActivities, trackingPoints } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import { AppSettingsService } from '../hikes/app-settings.service.js';
import { HikesService } from '../hikes/hikes.service.js';
import { WeatherService } from '../weather/weather.service.js';
import { DailyFactsGatherer } from './facts/daily-facts.gatherer.js';
import { DistanceFacts } from './facts/distance.facts.js';
import { MessagesFacts } from './facts/messages.facts.js';
import { TrailProgressFacts } from './facts/trail-progress.facts.js';
import { NarrativeBuilder, type ChatClient } from './generation/narrative.builder.js';
import { ChannelDispatcher } from './channel.dispatcher.js';
import { InAppChannel } from './in-app.channel.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER, NOTIFICATION_CHANNELS } from './notifications.types.js';

type Row = Record<string, unknown>;

/**
 * In-memory Drizzle stand-in: reads return the seeded rows of whichever table is queried,
 * predicates are ignored (so seed only in-window rows for SQL-filtered providers).
 * Inserts and updates only ever touch the notifications table.
 */
function fakeDb(seed: { points?: Row[]; activities?: Row[] }) {
  const stored: Row[] = [];
  const rowsOf = (table: unknown): Row[] =>
    table === notifications ? stored : table === stravaActivities ? (seed.activities ?? []) : table === trackingPoints ? (seed.points ?? []) : [];
  const query = (rows: Row[]): Promise<Row[]> & { where: () => unknown; orderBy: () => unknown; limit: (n: number) => unknown } => {
    const q = Object.assign(Promise.resolve(rows), {
      where: () => q,
      orderBy: () => q,
      limit: (n: number) => query(rows.slice(0, n)),
    });
    return q;
  };
  const db = {
    select: () => ({ from: (t: unknown) => query(rowsOf(t)) }),
    update: () => ({ set: (v: Row) => ({ where: () => { Object.assign(stored[0] ?? {}, v); return Promise.resolve(); } }) }),
    insert: () => ({
      values: (row: Row) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            if (stored.length > 0) return Promise.resolve([]);
            const r = { id: 1, delivered: false, ...row };
            stored.push(r);
            return Promise.resolve([r]);
          },
        }),
      }),
    }),
  };
  return { db, stored };
}

const DAY = '2026-06-10';
// 21:00 EDT on the 10th: the scheduler's tick time, still the 10th in New York.
const RUN_AT = new Date('2026-06-11T01:00:00Z');
const pt = (timestamp: string, latitude: number, extra: Row = {}): Row => ({
  timestamp, latitude, longitude: -84.2, message: null, eventType: 'track', ...extra,
});
const HIKE = { id: 1, startDate: '2026-06-01', endDate: null };

interface Options {
  points?: Row[];
  activities?: Row[];
  env?: { OPENROUTER_API_KEY?: string; OPENROUTER_MODEL?: string };
  forecast?: unknown;
  send?: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
}

async function setup(o: Options = {}) {
  const { db, stored } = fakeDb(o);
  const send = o.send ?? jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const getForecast = jest.fn(() => Promise.resolve(o.forecast ?? { error: 'Weather unavailable' }));
  const builder = new NarrativeBuilder(o.env ?? {}, { client: { chat: { send } } as unknown as ChatClient, sleep: () => Promise.resolve() });
  const module = await Test.createTestingModule({
    providers: [
      NotificationsService, DailyFactsGatherer, DistanceFacts, MessagesFacts, TrailProgressFacts, InAppChannel, ChannelDispatcher,
      { provide: DRIZZLE, useValue: db },
      { provide: HikesService, useValue: { getAll: () => Promise.resolve([HIKE]), getById: (id: number) => Promise.resolve(id === 1 ? HIKE : null) } },
      { provide: AppSettingsService, useValue: {} },
      { provide: WeatherService, useValue: { getForecast } },
      { provide: FACTS_GATHERER, useExisting: DailyFactsGatherer },
      { provide: MESSAGE_BUILDER, useValue: builder },
      { provide: NOTIFICATION_CHANNELS, useFactory: (c: InAppChannel) => [c], inject: [InAppChannel] },
      { provide: DISPATCHER, useExisting: ChannelDispatcher },
    ],
  }).compile();
  return { service: module.get(NotificationsService), stored, send, getForecast };
}

const forecast = {
  latitude: 34.6, longitude: -84.2, pointTimestamp: '', timezone: 'America/New_York',
  forecast: { time: [DAY, '2026-06-11'], temperature_2m_max: [20, 21], temperature_2m_min: [10, 11], weathercode: [3, 61] },
};
const text = (stored: Row[]): string => stored[0].text as string;

describe('daily update, end to end', () => {
  it('sums Strava activities for the distance when present', async () => {
    const { service, stored } = await setup({
      activities: [
        { distance: 12000, startDate: '2026-06-10T12:00:00Z' },
        { distance: 3000, startDate: '2026-06-10T15:00:00Z' },
      ],
      points: [pt('2026-06-10T12:00:00Z', 34.6), pt('2026-06-10T13:00:00Z', 34.9)],
    });
    await service.runDailyUpdate(RUN_AT);
    expect(text(stored)).toContain('He walked 15 km today.');
    expect(stored[0]).toMatchObject({ delivered: true });
  });

  it('uses the Garmin track length when there are no Strava activities', async () => {
    const { service, stored } = await setup({ points: [pt('2026-06-10T12:00:00Z', 34.6), pt('2026-06-10T13:00:00Z', 34.7)] });
    await service.runDailyUpdate(RUN_AT);
    expect(text(stored)).toContain('He walked 11.1 km today.');
  });

  it('says there was no signal when no point arrived', async () => {
    const { service, stored } = await setup();
    await service.runDailyUpdate(RUN_AT);
    expect(text(stored)).toContain('No signal today');
  });

  it('quotes messages exactly and leaves poop-tagged points out', async () => {
    const { service, stored } = await setup({
      points: [
        pt('2026-06-10T12:00:00Z', 34.6, { message: 'Feet hurt, views unreal!' }),
        pt('2026-06-10T13:00:00Z', 34.6, { message: 'secret pooped note', eventType: 'poop' }),
      ],
    });
    await service.runDailyUpdate(RUN_AT);
    expect(text(stored)).toContain('"Feet hurt, views unreal!"');
    expect(JSON.stringify(stored[0])).not.toContain('pooped');
  });

  it('puts no coordinates in the text or the stored facts', async () => {
    const { service, stored } = await setup({ points: [pt('2026-06-10T12:00:00Z', 34.6271), pt('2026-06-10T13:00:00Z', 34.6272)] });
    await service.runDailyUpdate(RUN_AT);
    expect(text(stored)).toContain('Trail progress:');
    expect(JSON.stringify(stored[0])).not.toMatch(/34\.627|-84\.2/);
  });

  it('writes a weather line from the forecast, and none when it is unavailable', async () => {
    const withIt = await setup({ forecast });
    await withIt.service.runDailyUpdate(RUN_AT);
    expect(text(withIt.stored)).toContain('Forecast:');
    const without = await setup();
    await without.service.runDailyUpdate(RUN_AT);
    expect(text(without.stored)).not.toMatch(/forecast|weather/i);
  });

  it('retries a failing model call, then stores the template marked fallback', async () => {
    const send = jest.fn<(...args: unknown[]) => Promise<unknown>>().mockRejectedValue(new Error('boom'));
    const { service, stored } = await setup({ env: { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'm' }, send });
    await service.runDailyUpdate(RUN_AT);
    expect(send).toHaveBeenCalledTimes(3);
    expect(stored[0]).toMatchObject({ fallback: true, delivered: true });
    expect(text(stored)).toContain('No signal today');
  });

  it('is off without OPENROUTER_API_KEY: template used, model never called', async () => {
    const { service, stored, send } = await setup({ env: { OPENROUTER_MODEL: 'm' } });
    await service.runDailyUpdate(RUN_AT);
    expect(send).not.toHaveBeenCalled();
    expect(stored[0]).toMatchObject({ fallback: true });
  });

  it('a second run for the same hike and date writes and sends nothing', async () => {
    const { service, stored, getForecast } = await setup();
    await service.runDailyUpdate(RUN_AT);
    getForecast.mockClear();
    await service.runDailyUpdate(RUN_AT);
    expect(stored).toHaveLength(1);
    expect(getForecast).not.toHaveBeenCalled();
  });

  it('produces nothing for a day outside the hike date range', async () => {
    const { service, stored } = await setup();
    await service.runDailyUpdate(new Date('2026-05-20T12:00:00Z'));
    await service.runDailyUpdateFor(1, '2026-05-20');
    expect(stored).toHaveLength(0);
  });

  it('runs one hike for the date the scheduler hands over', async () => {
    const { service, stored } = await setup();
    await service.runDailyUpdateFor(1, DAY);
    expect(stored[0]).toMatchObject({ hikeId: 1, date: DAY, delivered: true });
  });
});
