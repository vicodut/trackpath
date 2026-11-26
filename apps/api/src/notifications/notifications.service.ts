import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { notifications } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import { AppSettingsService } from '../hikes/app-settings.service.js';
import { HikesService } from '../hikes/hikes.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER } from './notifications.types.js';
import type { DeliverableNotification, Dispatcher, FactsGatherer, MessageBuilder, NotificationSummary } from './notifications.types.js';

/** The trail day is America/New_York's; en-CA formats as YYYY-MM-DD. */
const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly hikes: HikesService,
    private readonly settings: AppSettingsService,
    @Inject(FACTS_GATHERER) private readonly gatherer: FactsGatherer,
    @Inject(MESSAGE_BUILDER) private readonly builder: MessageBuilder,
    @Inject(DISPATCHER) private readonly dispatcher: Dispatcher,
  ) {}

  /** Catch-up: generate today's update, or re-dispatch an undelivered one, after downtime. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.runDailyUpdate(new Date());
    } catch (err) {
      // A failing stage must not stop the API from booting.
      this.logger.error('Startup daily update failed', err);
    }
  }

  /**
   * Gather facts, build the message, store the row, dispatch, then mark it
   * delivered, for every hike running on `now`'s New York date. At most one row
   * per hike and date. A row saved but not delivered (dispatch failed earlier)
   * is re-dispatched without gathering or building again.
   */
  async runDailyUpdate(now: Date): Promise<void> {
    const date = NY_DATE.format(now);
    const active = (await this.hikes.getAll()).filter(
      (h) => h.startDate <= date && (h.endDate === null || date <= h.endDate),
    );
    for (const hike of active) {
      const found = await this.db
        .select()
        .from(notifications)
        .where(and(eq(notifications.hikeId, hike.id), eq(notifications.date, date)))
        .limit(1);
      if (found.length > 0) {
        // Saved earlier: only a failed dispatch is left to retry.
        const row = found[0];
        if (!row.delivered) await this.deliver({ id: row.id, hikeId: hike.id, text: row.text });
        continue;
      }

      const facts = await this.gatherer.gather(hike.id, date);
      const { text, fallback } = await this.builder.build(facts);
      // The unique (hike, date) constraint settles concurrent runs: only the inserter dispatches.
      const inserted = await this.db
        .insert(notifications)
        .values({ hikeId: hike.id, date, facts, text, fallback })
        .onConflictDoNothing()
        .returning({ id: notifications.id });
      if (inserted.length > 0) await this.deliver({ id: inserted[0].id, hikeId: hike.id, text });
    }
  }

  /** Every stored update of the default hike, newest first, without the facts snapshot. */
  async getHistory(): Promise<NotificationSummary[]> {
    const hikeId = await this.settings.getDefaultHikeId();
    if (hikeId === null) return [];
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.hikeId, hikeId))
      .orderBy(desc(notifications.date));
    return rows.map(({ date, text, fallback, delivered }) => ({ date, text, fallback, delivered }));
  }

  /** The in-app channel flags the row delivered; a failed channel leaves it for the next run's retry. */
  private async deliver(notification: DeliverableNotification): Promise<void> {
    for (const r of await this.dispatcher.dispatch(notification)) {
      if (!r.ok) this.logger.error(`Channel ${r.channel} failed for notification ${String(notification.id)}: ${r.error ?? ''}`);
    }
  }
}
