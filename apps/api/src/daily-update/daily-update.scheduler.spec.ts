import { jest } from '@jest/globals';

const upsertJobScheduler = jest.fn<(...a: unknown[]) => Promise<void>>();
const add = jest.fn<(...a: unknown[]) => Promise<void>>();
const queueClose = jest.fn<() => Promise<void>>();
const workerClose = jest.fn<() => Promise<void>>();
type Job = { name: string; data: unknown };
let processor: (job: Job) => Promise<void>;

jest.unstable_mockModule('bullmq', () => ({
  createPostgresBackend: 'backend',
  withBackend: () => ({
    Queue: jest.fn(() => ({ upsertJobScheduler, add, close: queueClose })),
    Worker: jest.fn((_name: string, p: typeof processor) => {
      processor = p;
      return { close: workerClose };
    }),
  }),
}));

const { DailyUpdateScheduler } = await import('./daily-update.scheduler.js');

describe('DailyUpdateScheduler', () => {
  const handler = jest.fn<(hikeId: number, date: string) => Promise<void>>();
  const getDefaultHikeId = jest.fn<() => Promise<number | null>>();
  const scheduler = new DailyUpdateScheduler({} as never, handler, { getDefaultHikeId } as never);

  beforeEach(async () => {
    jest.clearAllMocks();
    getDefaultHikeId.mockResolvedValue(7);
    await scheduler.onModuleInit();
  });
  afterEach(() => jest.useRealTimers());

  it('registers a job scheduler at 21:00 America/New_York', () => {
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'daily-update',
      { pattern: '0 21 * * *', tz: 'America/New_York' },
      expect.anything(),
    );
  });

  it('enqueues one run job keyed by hike and New York date when the tick fires', async () => {
    // 02:30 UTC on the 26th is 21:30 EST on the 25th
    jest.useFakeTimers({ now: Date.parse('2026-11-26T02:30:00Z') });
    await processor({ name: 'daily-update', data: {} });
    expect(add).toHaveBeenCalledWith(
      'daily-update-run',
      { hikeId: 7, date: '2026-11-25' },
      { deduplication: { id: '7:2026-11-25', ttl: 36 * 60 * 60 * 1000 } },
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('skips when there is no default hike', async () => {
    getDefaultHikeId.mockResolvedValue(null);
    await processor({ name: 'daily-update', data: {} });
    expect(add).not.toHaveBeenCalled();
  });

  it('invokes the handler with hike and date when the run job fires', async () => {
    await processor({ name: 'daily-update-run', data: { hikeId: 7, date: '2026-11-25' } });
    expect(handler).toHaveBeenCalledWith(7, '2026-11-25');
  });

  it('closes queue and worker on shutdown', async () => {
    await scheduler.onModuleDestroy();
    expect(queueClose).toHaveBeenCalled();
    expect(workerClose).toHaveBeenCalled();
  });
});
