import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GarminModule } from './garmin/garmin.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule, GarminModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
