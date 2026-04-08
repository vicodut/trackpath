import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GarminModule } from './garmin/garmin.module.js';
import { StravaModule } from './strava/strava.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    // ConfigModule first — validates env before any other provider is created.
    ConfigModule,
    // ScheduleModule registers the global SchedulerRegistry used by
    // GarminService (dynamic interval) and StravaService (@Cron).
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    GarminModule,
    StravaModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
