import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPostgresBackend, withBackend, type PgPool } from 'bullmq';
import { BULLMQ_POOL, DAILY_UPDATE_HANDLER, type DailyUpdateHandler } from './daily-update.constants.js';

const QUEUE_NAME = 'daily-update';

/**
 * Fires the daily-update handler at 21:00 America/New_York using BullMQ on
 * Postgres (no Redis). The job scheduler is upserted on boot, so restarts and
 * multiple instances converge on one schedule.
 * shortcut: no per-hike/date singleton key, the scheduler yields one job per day; add one when the handler is multi-hike.
 */
@Injectable()
export class DailyUpdateScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyUpdateScheduler.name);
  private closers: (() => Promise<void>)[] = [];

  constructor(
    @Inject(BULLMQ_POOL) private readonly pool: PgPool,
    @Inject(DAILY_UPDATE_HANDLER) private readonly handler: DailyUpdateHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    const { Queue, Worker } = withBackend(createPostgresBackend);
    const queue = new Queue(QUEUE_NAME, { connection: this.pool });
    const worker = new Worker(
      QUEUE_NAME,
      async () => {
        this.logger.log('Daily update job fired');
        await this.handler();
      },
      { connection: this.pool },
    );
    this.closers = [() => worker.close(), () => queue.close()];
    await queue.upsertJobScheduler(
      QUEUE_NAME,
      { pattern: '0 21 * * *', tz: 'America/New_York' },
      { name: QUEUE_NAME },
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const close of this.closers) await close();
  }
}
