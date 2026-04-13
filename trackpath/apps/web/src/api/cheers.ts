export interface Cheer {
  id: number;
  name: string;
  message: string;
  isPublic: boolean;
  createdAt: string;
}

export async function fetchCheers(): Promise<Cheer[]> {
  const res = await fetch('/api/cheers');
  if (!res.ok) throw new Error('Failed to fetch cheers');
  return res.json();
}

export async function fetchAllCheers(): Promise<Cheer[]> {
  const res = await fetch('/api/cheers/all');
  if (!res.ok) throw new Error('Failed to fetch cheers');
  return res.json();
}

export async function createCheer(data: { name: string; message: string; isPublic: boolean }): Promise<Cheer> {
  const res = await fetch('/api/cheers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create cheer');
  return res.json();
}

export async function deleteCheer(id: number): Promise<void> {
  const res = await fetch(`/api/cheers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete cheer');
}
