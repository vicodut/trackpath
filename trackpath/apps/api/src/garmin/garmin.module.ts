import { Module } from '@nestjs/common';
import { SyncPeriodsModule } from '../sync-periods/sync-periods.module.js';
import { HikesModule } from '../hikes/hikes.module.js';
import { GarminController } from './garmin.controller.js';
import { GarminService } from './garmin.service.js';

@Module({
  imports: [SyncPeriodsModule, HikesModule],
  controllers: [GarminController],
  providers: [GarminService],
  // Export GarminService so other modules (e.g. a future AdminModule) can
  // inject getLastGarminPoint(), countPoints(), getSyncLogs() without
  // re-querying the DB themselves.
  exports: [GarminService],
})
export class GarminModule {}
