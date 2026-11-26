import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { notifications } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import { HikesService } from '../hikes/hikes.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER } from './notifications.types.js';
import type { Dispatcher, FactsGatherer, MessageBuilder } from './notifications.types.js';

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly hikes: HikesService,
    @Inject(FACTS_GATHERER) private readonly gatherer: FactsGatherer,
    @Inject(MESSAGE_BUILDER) private readonly builder: MessageBuilder,
    @Inject(DISPATCHER) private readonly dispatcher: Dispatcher,
  ) {}

  /** Catch-up: generate today's update if the app was down when it was due. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.runDailyUpdate(new Date());
    } catch (err) {
      // A failing stage must not stop the API from booting.
      this.logger.error('Startup daily update failed', err);
    }
  }

  /**
   * Gather facts, build the message, store the row, dispatch, for every hike
   * running on `now`'s date. At most one update per hike and date: if the row
   * exists, nothing is gathered, written or sent.
   */
  async runDailyUpdate(now: Date): Promise<void> {
    const date = now.toISOString().slice(0, 10);
    const active = (await this.hikes.getAll()).filter(
      (h) => h.startDate <= date && (h.endDate === null || date <= h.endDate),
    );
    for (const hike of active) {
      const existing = await this.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.hikeId, hike.id), eq(notifications.date, date)))
        .limit(1);
      if (existing.length > 0) continue;

      const facts = await this.gatherer.gather(hike.id, date);
      const { text, fallback } = await this.builder.build(facts);
      // The unique (hike, date) constraint settles concurrent runs: only the inserter dispatches.
      const inserted = await this.db
        .insert(notifications)
        .values({ hikeId: hike.id, date, facts, text, fallback })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      if (inserted.length === 0) continue;
      await this.dispatcher.dispatch(hike.id, text);
    }
  }
}
