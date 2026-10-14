import { Module } from '@nestjs/common';
import { HikesService } from './hikes.service.js';
import { AppSettingsService } from './app-settings.service.js';
import { HikeClassifierService } from './hike-classifier.service.js';

@Module({
  providers: [HikesService, AppSettingsService, HikeClassifierService],
  exports: [HikesService, AppSettingsService, HikeClassifierService],
})
export class HikesModule {}
