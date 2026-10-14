export interface SyncPeriod {
  id: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export async function fetchSyncPeriods(): Promise<SyncPeriod[]> {
  const res = await fetch('/api/admin/sync-periods');
  if (!res.ok) throw new Error('Failed to load sync periods');
  return res.json();
}

export async function addSyncPeriod(startDate: string, endDate: string): Promise<SyncPeriod> {
  const res = await fetch('/api/admin/sync-periods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  if (!res.ok) throw new Error('Failed to add sync period');
  return res.json();
}

export async function deleteSyncPeriod(id: number): Promise<void> {
  const res = await fetch(`/api/admin/sync-periods/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete sync period');
}
