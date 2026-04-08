import { Module } from '@nestjs/common';
import { GarminModule } from '../garmin/garmin.module.js';
import { WeatherController } from './weather.controller.js';
import { WeatherService } from './weather.service.js';

@Module({
  imports: [GarminModule],
  controllers: [WeatherController],
  providers: [WeatherService],
})
export class WeatherModule {}
