import { jest } from '@jest/globals';

const upsertJobScheduler = jest.fn<(...a: unknown[]) => Promise<void>>();
const queueClose = jest.fn<() => Promise<void>>();
const workerClose = jest.fn<() => Promise<void>>();
let processor: (job: { id: string }) => Promise<void>;

jest.unstable_mockModule('bullmq', () => ({
  createPostgresBackend: 'backend',
  withBackend: () => ({
    Queue: jest.fn(() => ({ upsertJobScheduler, close: queueClose })),
    Worker: jest.fn((_name: string, p: typeof processor) => {
      processor = p;
      return { close: workerClose };
    }),
  }),
}));

const { DailyUpdateScheduler } = await import('./daily-update.scheduler.js');

describe('DailyUpdateScheduler', () => {
  const handler = jest.fn<() => Promise<void>>();
  const pool = {};
  const scheduler = new DailyUpdateScheduler(pool as never, handler);

  beforeEach(() => jest.clearAllMocks());

  it('registers a job scheduler at 21:00 America/New_York', async () => {
    await scheduler.onModuleInit();
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'daily-update',
      { pattern: '0 21 * * *', tz: 'America/New_York' },
      expect.anything(),
    );
  });

  it('invokes the handler when the job fires', async () => {
    await scheduler.onModuleInit();
    await processor({ id: '1' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('closes queue and worker on shutdown', async () => {
    await scheduler.onModuleInit();
    await scheduler.onModuleDestroy();
    expect(queueClose).toHaveBeenCalled();
    expect(workerClose).toHaveBeenCalled();
  });
});
