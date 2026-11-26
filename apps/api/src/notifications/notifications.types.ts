import type { DailyFacts } from '@trackpath/db/schema';

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

export interface Dispatcher {
  dispatch(hikeId: number, text: string): Promise<void>;
}

export const FACTS_GATHERER = Symbol('FACTS_GATHERER');
export const MESSAGE_BUILDER = Symbol('MESSAGE_BUILDER');
export const DISPATCHER = Symbol('DISPATCHER');
