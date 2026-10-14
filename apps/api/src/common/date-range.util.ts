/** Normalises a YYYY-MM-DD (or full ISO8601) date to the start of that UTC day. */
export function toUtcDayStart(date: string): string {
  return date.length === 10 ? `${date}T00:00:00Z` : date;
}

/** Normalises a YYYY-MM-DD (or full ISO8601) date to the end of that UTC day. */
export function toUtcDayEnd(date: string): string {
  return date.length === 10 ? `${date}T23:59:59Z` : date;
}
