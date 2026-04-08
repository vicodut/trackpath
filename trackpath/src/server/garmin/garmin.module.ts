import { Module } from '@nestjs/common';
import { GarminController } from './garmin.controller.js';
import { GarminService } from './garmin.service.js';

@Module({
  controllers: [GarminController],
  providers: [GarminService],
  // Export GarminService so other modules (e.g. a future AdminModule) can
  // inject getLastGarminPoint(), countPoints(), getSyncLogs() without
  // re-querying the DB themselves.
  exports: [GarminService],
})
export class GarminModule {}
