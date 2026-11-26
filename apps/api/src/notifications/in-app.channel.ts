import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { notifications } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type { DeliverableNotification, DeliveryResult, NotificationChannel, Recipient } from './notifications.types.js';

/**
 * The pane reads the stored `notifications` rows, so the row is the store:
 * delivering in-app means flagging it delivered. Ignores the recipient.
 */
@Injectable()
export class InAppChannel implements NotificationChannel {
  readonly name = 'in-app';

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async deliver(notification: DeliverableNotification, _recipient: Recipient | null): Promise<DeliveryResult> {
    await this.db.update(notifications).set({ delivered: true }).where(eq(notifications.id, notification.id));
    return { channel: this.name, ok: true };
  }
}
