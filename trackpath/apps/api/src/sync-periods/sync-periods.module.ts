import { Module } from '@nestjs/common';
import { SyncPeriodsController } from './sync-periods.controller.js';
import { SyncPeriodsService } from './sync-periods.service.js';

@Module({
  controllers: [SyncPeriodsController],
  providers: [SyncPeriodsService],
  exports: [SyncPeriodsService],
})
export class SyncPeriodsModule {}
