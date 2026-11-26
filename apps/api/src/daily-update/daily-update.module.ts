import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HikesModule } from '../hikes/hikes.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import pg from 'pg';
import type { Env } from '../config/env.schema.js';
import { BULLMQ_POOL, DAILY_UPDATE_HANDLER, type DailyUpdateHandler } from './daily-update.constants.js';
import { DailyUpdateScheduler } from './daily-update.scheduler.js';

@Module({
  imports: [HikesModule, NotificationsModule],
  providers: [
    {
      provide: BULLMQ_POOL,
      inject: [ConfigService],
      // BullMQ ignores its `schema` option for a caller-supplied pool, so search_path is set here.
      useFactory: (config: ConfigService<Env, true>) =>
        new pg.Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          options: '-c search_path=bullmq',
        }),
    },
    {
      provide: DAILY_UPDATE_HANDLER,
      inject: [NotificationsService],
      useFactory: (n: NotificationsService): DailyUpdateHandler => (hikeId, date) => n.runDailyUpdateFor(hikeId, date),
    },
    DailyUpdateScheduler,
  ],
})
export class DailyUpdateModule {}
