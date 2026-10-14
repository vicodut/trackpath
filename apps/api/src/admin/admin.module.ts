import { Module } from '@nestjs/common';
import { GarminModule } from '../garmin/garmin.module.js';
import { StravaModule } from '../strava/strava.module.js';
import { HikesModule } from '../hikes/hikes.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [GarminModule, StravaModule, HikesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
