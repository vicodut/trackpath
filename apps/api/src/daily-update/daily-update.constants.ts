export const DAILY_UPDATE_HANDLER = Symbol('DAILY_UPDATE_HANDLER');
export const BULLMQ_POOL = Symbol('BULLMQ_POOL');

/** Called once per hike and New York date when the 21:00 job fires. The real one is wired in a later ticket. */
export type DailyUpdateHandler = (hikeId: number, date: string) => Promise<void>;
