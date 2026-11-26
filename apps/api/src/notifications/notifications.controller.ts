import { Controller, Get } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import type { NotificationSummary } from './notifications.types.js';

/** Public and read-only: the default hike's daily update history. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  getHistory(): Promise<NotificationSummary[]> {
    return this.notifications.getHistory();
  }
}
