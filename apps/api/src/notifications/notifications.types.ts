import type { DailyFacts, Notification } from '@trackpath/db/schema';

export interface FactsGatherer {
  gather(hikeId: number, date: string): Promise<DailyFacts>;
}

export interface BuiltMessage {
  text: string;
  /** True when the text is the templated fallback. */
  fallback: boolean;
}

export interface MessageBuilder {
  build(facts: DailyFacts): Promise<BuiltMessage>;
}

/** The stored update a channel delivers. */
export type DeliverableNotification = Pick<Notification, 'id' | 'hikeId' | 'text'>;

/** Who a channel addresses; later channels (email, chat) read their address from it. */
export interface Recipient {
  address: string;
}

export interface DeliveryResult {
  channel: string;
  ok: boolean;
  error?: string;
}

export interface NotificationChannel {
  readonly name: string;
  /** `recipient` is null for channels that are not per-person (in-app). May reject; the Dispatcher reports it. */
  deliver(notification: DeliverableNotification, recipient: Recipient | null): Promise<DeliveryResult>;
}

/** Fans out to every channel and never rejects: a failing channel is reported in its result. */
export interface Dispatcher {
  dispatch(notification: DeliverableNotification): Promise<DeliveryResult[]>;
}

export const FACTS_GATHERER = Symbol('FACTS_GATHERER');
export const MESSAGE_BUILDER = Symbol('MESSAGE_BUILDER');
export const DISPATCHER = Symbol('DISPATCHER');
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');
