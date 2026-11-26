import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPostgresBackend, withBackend, type PgPool } from 'bullmq';
import { AppSettingsService } from '../hikes/app-settings.service.js';
import { BULLMQ_POOL, DAILY_UPDATE_HANDLER, type DailyUpdateHandler } from './daily-update.constants.js';

const TICK = 'daily-update';
const RUN = 'daily-update-run';
const TIME_ZONE = 'America/New_York';
const DEDUP_TTL_MS = 36 * 60 * 60 * 1000;

/**
 * Fires the daily-update handler at 21:00 America/New_York using BullMQ on
 * Postgres (no Redis). The job scheduler is upserted on boot, so restarts and
 * multiple instances converge on one schedule. Scheduler templates cannot carry
 * a deduplication key, so each tick enqueues a run job keyed by hike and New
 * York date; BullMQ drops a second enqueue for the same key within the TTL.
 */
@Injectable()
export class DailyUpdateScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyUpdateScheduler.name);
  private closers: (() => Promise<void>)[] = [];

  constructor(
    @Inject(BULLMQ_POOL) private readonly pool: PgPool,
    @Inject(DAILY_UPDATE_HANDLER) private readonly handler: DailyUpdateHandler,
    private readonly settings: AppSettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { Queue, Worker } = withBackend(createPostgresBackend);
    const queue = new Queue(TICK, { connection: this.pool });
    const worker = new Worker(
      TICK,
      async (job) => {
        const data = job.data as { hikeId?: number; date?: string };
        if (job.name === RUN) {
          await this.handler(data.hikeId as number, data.date as string);
          return;
        }
        const hikeId = await this.settings.getDefaultHikeId();
        if (hikeId === null) {
          this.logger.warn('No default hike, skipping daily update');
          return;
        }
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
        await queue.add(RUN, { hikeId, date }, { deduplication: { id: `${hikeId}:${date}`, ttl: DEDUP_TTL_MS } });
      },
      { connection: this.pool },
    );
    this.closers = [() => worker.close(), () => queue.close()];
    await queue.upsertJobScheduler(TICK, { pattern: '0 21 * * *', tz: TIME_ZONE }, { name: TICK });
  }

  async onModuleDestroy(): Promise<void> {
    for (const close of this.closers) await close();
  }
}
