import { Controller, Get, Inject } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { trackingPoints } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('db')
  async checkDb() {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(trackingPoints);
    return { status: 'ok', trackingPointsCount: Number(total) };
  }
}
