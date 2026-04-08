import { Controller, Get, Inject } from '@nestjs/common';
import { count } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema.js';
import { trackingPoints } from '../../db/schema.js';
import { DRIZZLE } from '../database/drizzle.constants.js';

type DrizzleClient = PostgresJsDatabase<typeof schema>;

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
