import { Module } from '@nestjs/common';
import { SyncPeriodsModule } from '../sync-periods/sync-periods.module.js';
import { StravaController } from './strava.controller.js';
import { StravaService } from './strava.service.js';

@Module({
  imports: [SyncPeriodsModule],
  controllers: [StravaController],
  providers: [StravaService],
  exports: [StravaService],
})
export class StravaModule {}
