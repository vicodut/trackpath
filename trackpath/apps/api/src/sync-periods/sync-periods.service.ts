import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { syncPeriods } from '@trackpath/db/schema';
import type { SyncPeriod } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import { toUtcDayStart, toUtcDayEnd } from '../common/date-range.util.js';
import type { CreateSyncPeriodDto } from './sync-periods.dto.js';

@Injectable()
export class SyncPeriodsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  getAll(): Promise<SyncPeriod[]> {
    return this.db.select().from(syncPeriods).orderBy(asc(syncPeriods.startDate));
  }

  async create(dto: CreateSyncPeriodDto): Promise<SyncPeriod> {
    if (dto.startDate > dto.endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const [row] = await this.db.insert(syncPeriods).values(dto).returning();
    return row;
  }

  async remove(id: number): Promise<void> {
    await this.db.delete(syncPeriods).where(eq(syncPeriods.id, id));
  }

  /**
   * True when no periods are configured (unrestricted) or `date` falls
   * within at least one configured period (inclusive, whole-day bounds).
   */
  static isWithinPeriods(date: string, periods: SyncPeriod[]): boolean {
    if (periods.length === 0) return true;
    const t = new Date(date).getTime();
    return periods.some((p) => {
      const start = new Date(toUtcDayStart(p.startDate)).getTime();
      const end = new Date(toUtcDayEnd(p.endDate)).getTime();
      return t >= start && t <= end;
    });
  }
}
