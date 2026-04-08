import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GarminModule } from './garmin/garmin.module.js';
import { StravaModule } from './strava/strava.module.js';
import { BlogModule } from './blog/blog.module.js';
import { WeatherModule } from './weather/weather.module.js';
import { GearModule } from './gear/gear.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    GarminModule,
    StravaModule,
    BlogModule,
    WeatherModule,
    GearModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
