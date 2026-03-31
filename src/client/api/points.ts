import type { TrackingPoint, SyncResult } from '../types';

export async function getPoints(): Promise<TrackingPoint[]> {
  const res = await fetch('/api/points');
  return res.json();
}

export async function addPoint(data: {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  message?: string | null;
  tag?: string | null;
}): Promise<{ ok: boolean; point: TrackingPoint }> {
  const res = await fetch('/api/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new Error('Please log in to add points');
  return res.json();
}

export async function deletePoint(id: number): Promise<void> {
  const res = await fetch(`/api/points/${id}`, { method: 'DELETE' });
  if (res.status === 401) throw new Error('Please log in to delete points');
}

export async function syncPoints(): Promise<SyncResult> {
  const res = await fetch('/api/sync', { method: 'POST' });
  if (res.status === 401) throw new Error('Please log in to sync');
  return res.json();
}
