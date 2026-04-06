import type { GearCategory, GearItem } from '../types';

export async function getGear(): Promise<{ categories: GearCategory[]; items: GearItem[] }> {
  const res = await fetch('/api/gear');
  return res.json();
}

export async function addCategory(data: { name: string; color: string; sortOrder: number }): Promise<GearCategory> {
  const res = await fetch('/api/gear/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add category');
  return res.json();
}

export async function updateCategory(id: number, data: Partial<{ name: string; color: string; sortOrder: number }>): Promise<void> {
  const res = await fetch(`/api/gear/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update category');
}

export async function deleteCategory(id: number): Promise<void> {
  const res = await fetch(`/api/gear/categories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete category');
}

export async function addItem(data: {
  categoryId: number; name: string; weightG: number; qty: number;
  worn: boolean; consumable: boolean; notes?: string;
}): Promise<GearItem> {
  const res = await fetch('/api/gear/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add item');
  return res.json();
}

export async function updateItem(id: number, data: Partial<{
  name: string; weightG: number; qty: number;
  worn: boolean; consumable: boolean; categoryId: number; notes: string;
}>): Promise<void> {
  const res = await fetch(`/api/gear/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update item');
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`/api/gear/items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete item');
}

export async function importCsv(rows: {
  name: string; category: string; weightG: number; qty: number;
  worn: boolean; consumable: boolean; notes?: string;
}[]): Promise<{ imported: number }> {
  const res = await fetch('/api/gear/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error('Import failed');
  return res.json();
}
