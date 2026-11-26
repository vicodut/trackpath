import type { NotificationSummary } from '../types';

export async function fetchNotifications(): Promise<NotificationSummary[]> {
  const res = await fetch('/api/notifications');
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}
