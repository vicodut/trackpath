import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { Env } from '../config/env.schema.js';
import { BULLMQ_POOL, DAILY_UPDATE_HANDLER, type DailyUpdateHandler } from './daily-update.constants.js';
import { DailyUpdateScheduler } from './daily-update.scheduler.js';

const defaultHandler: DailyUpdateHandler = () => {
  new Logger('DailyUpdate').log('No daily update handler wired yet');
  return Promise.resolve();
};

@Module({
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
    { provide: DAILY_UPDATE_HANDLER, useValue: defaultHandler },
    DailyUpdateScheduler,
  ],
})
export class DailyUpdateModule {}
