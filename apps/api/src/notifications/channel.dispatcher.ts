import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_CHANNELS } from './notifications.types.js';
import type { DeliverableNotification, DeliveryResult, Dispatcher, NotificationChannel } from './notifications.types.js';

@Injectable()
export class ChannelDispatcher implements Dispatcher {
  constructor(@Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[]) {}

  // Recipient is null until subscriptions exist (later tickets).
  async dispatch(notification: DeliverableNotification): Promise<DeliveryResult[]> {
    return Promise.all(
      this.channels.map(async (c) => {
        try {
          return await c.deliver(notification, null);
        } catch (err) {
          return { channel: c.name, ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
  }
}
