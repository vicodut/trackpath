import { Module } from '@nestjs/common';
import { StravaController } from './strava.controller.js';
import { StravaService } from './strava.service.js';

@Module({
  controllers: [StravaController],
  providers: [StravaService],
  exports: [StravaService],
})
export class StravaModule {}
