import { Module } from '@nestjs/common';
import { HikesModule } from '../hikes/hikes.module.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER } from './notifications.types.js';

// Placeholder stages: replaced by the gather/build/dispatch tickets (#20-#24).
const placeholderGatherer = {
  provide: FACTS_GATHERER,
  useValue: { gather: (hikeId: number, date: string) => Promise.resolve({ hikeId, date, distanceKmToday: null }) },
};
const placeholderBuilder = {
  provide: MESSAGE_BUILDER,
  useValue: { build: () => Promise.resolve({ text: '', fallback: true }) },
};
const noopDispatcher = { provide: DISPATCHER, useValue: { dispatch: () => Promise.resolve() } };

@Module({
  imports: [HikesModule],
  providers: [NotificationsService, placeholderGatherer, placeholderBuilder, noopDispatcher],
  exports: [NotificationsService],
})
export class NotificationsModule {}
