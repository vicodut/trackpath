import { Module } from '@nestjs/common';
import { HikesModule } from '../hikes/hikes.module.js';
import { ChannelDispatcher } from './channel.dispatcher.js';
import { InAppChannel } from './in-app.channel.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER, NOTIFICATION_CHANNELS } from './notifications.types.js';

// Placeholder stages: replaced by the gather/build/dispatch tickets (#20-#24).
const placeholderGatherer = {
  provide: FACTS_GATHERER,
  useValue: { gather: (hikeId: number, date: string) => Promise.resolve({ hikeId, date, distanceKmToday: null }) },
};
const placeholderBuilder = {
  provide: MESSAGE_BUILDER,
  useValue: { build: () => Promise.resolve({ text: '', fallback: true }) },
};
const channels = { provide: NOTIFICATION_CHANNELS, useFactory: (inApp: InAppChannel) => [inApp], inject: [InAppChannel] };
const dispatcher = { provide: DISPATCHER, useClass: ChannelDispatcher };

@Module({
  imports: [HikesModule],
  providers: [NotificationsService, placeholderGatherer, placeholderBuilder, InAppChannel, channels, dispatcher],
  exports: [NotificationsService],
})
export class NotificationsModule {}
