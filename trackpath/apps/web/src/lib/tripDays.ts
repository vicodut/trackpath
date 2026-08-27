import type { SyncPeriod } from '../api/syncPeriods';

export const MS_PER_DAY = 86_400_000;

export function dayStartMs(date: string): number {
  return new Date(date.length === 10 ? `${date}T00:00:00Z` : date).getTime();
}

export function dayEndMs(date: string): number {
  return new Date(date.length === 10 ? `${date}T23:59:59.999Z` : date).getTime();
}

export function earliestPeriodStartMs(periods: SyncPeriod[]): number {
  return Math.min(...periods.map(p => dayStartMs(p.startDate)));
}

export function latestPeriodEndMs(periods: SyncPeriod[]): number {
  return Math.max(...periods.map(p => dayEndMs(p.endDate)));
}

/**
 * Every calendar day (YYYY-MM-DD) actually inside a configured sync period,
 * up to `nowMs` — ascending order. A period `now` falls inside is capped at
 * today; a period entirely in the future contributes nothing; gaps between
 * periods (e.g. time at home) are excluded entirely.
 */
export function daysInPeriods(periods: SyncPeriod[], nowMs: number): string[] {
  const days: string[] = [];
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const p of sorted) {
    const startMs = dayStartMs(p.startDate);
    if (nowMs < startMs) continue; // period hasn't started yet
    const endMs = Math.min(dayEndMs(p.endDate), nowMs);
    for (let t = startMs; t <= endMs; t += MS_PER_DAY) {
      days.push(new Date(t).toISOString().slice(0, 10));
    }
  }
  return days;
}

/** True when `date` falls within at least one of the given periods. */
export function isWithinPeriods(date: string, periods: SyncPeriod[]): boolean {
  const t = dayStartMs(date.slice(0, 10));
  return periods.some(p => t >= dayStartMs(p.startDate) && t <= dayEndMs(p.endDate));
}
