import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema.js';
import { WeatherModule } from '../weather/weather.module.js';
import { DailyFactsGatherer } from './facts/daily-facts.gatherer.js';
import { DistanceFacts } from './facts/distance.facts.js';
import { MessagesFacts } from './facts/messages.facts.js';
import { TrailProgressFacts } from './facts/trail-progress.facts.js';
import { NarrativeBuilder } from './generation/narrative.builder.js';
import { HikesModule } from '../hikes/hikes.module.js';
import { ChannelDispatcher } from './channel.dispatcher.js';
import { InAppChannel } from './in-app.channel.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { DISPATCHER, FACTS_GATHERER, MESSAGE_BUILDER, NOTIFICATION_CHANNELS } from './notifications.types.js';

const gatherer = { provide: FACTS_GATHERER, useExisting: DailyFactsGatherer };
const builder = {
  provide: MESSAGE_BUILDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new NarrativeBuilder({
      OPENROUTER_API_KEY: config.get('OPENROUTER_API_KEY', { infer: true }),
      OPENROUTER_MODEL: config.get('OPENROUTER_MODEL', { infer: true }),
    }),
};
const channels = { provide: NOTIFICATION_CHANNELS, useFactory: (inApp: InAppChannel) => [inApp], inject: [InAppChannel] };
const dispatcher = { provide: DISPATCHER, useClass: ChannelDispatcher };

@Module({
  imports: [HikesModule, WeatherModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DailyFactsGatherer, DistanceFacts, TrailProgressFacts, MessagesFacts, gatherer, builder, InAppChannel, channels, dispatcher],
  exports: [NotificationsService],
})
export class NotificationsModule {}
