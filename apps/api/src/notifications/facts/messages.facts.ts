import { Inject, Injectable } from '@nestjs/common';
import { and, gte, lt } from 'drizzle-orm';
import { trackingPoints } from '@trackpath/db/schema';
import { DRIZZLE } from '../../database/drizzle.constants.js';
import type { DrizzleClient } from '../../database/drizzle.types.js';

const TZ = 'America/New_York';
const WINDOW_END_HOUR = 21;

export interface MessagesFact {
  /** inReach messages exactly as stored, in device-time order, poop-tagged points excluded. */
  messages: string[];
  /** True when at least one tracking point fell in the window. */
  hadSignal: boolean;
}

/** UTC instant of `hour:00` New York wall-clock time on `date` (YYYY-MM-DD). */
function nyInstant(date: string, hour: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  const offsetAt = (t: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(new Date(t));
    const p = (type: string): number => Number(parts.find((x) => x.type === type)?.value);
    return Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute')) - t;
  };
  // Two passes so the offset is taken at the right side of a DST change.
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
}

@Injectable()
export class MessagesFacts {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  /** Facts for the New York day `date` (YYYY-MM-DD), midnight to 21:00, by device timestamp. */
  async getForDay(date: string): Promise<MessagesFact> {
    const start = nyInstant(date, 0).toISOString();
    const end = nyInstant(date, WINDOW_END_HOUR).toISOString();

    // Timestamps are stored as UTC ISO text, so string comparison is chronological.
    const rows = await this.db
      .select({
        timestamp: trackingPoints.timestamp,
        message: trackingPoints.message,
        eventType: trackingPoints.eventType,
      })
      .from(trackingPoints)
      .where(and(gte(trackingPoints.timestamp, start), lt(trackingPoints.timestamp, end)));

    const messages: string[] = [];
    for (const r of [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
      if (r.eventType !== 'poop' && r.message) messages.push(r.message);
    }

    return { messages, hadSignal: rows.length > 0 };
  }
}
