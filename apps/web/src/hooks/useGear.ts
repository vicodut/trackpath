import { useState, useEffect, useCallback } from 'react';
import type { GearCategory, GearItem } from '../types';
import * as api from '../api/gear';

export function useGear() {
  const [categories, setCategories] = useState<GearCategory[]>([]);
  const [items, setItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getGear();
      setCategories(data.categories);
      setItems(data.items);
    } catch (e) {
      console.error('Failed to load gear:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addCategory = useCallback(async (name: string, color: string) => {
    const sortOrder = categories.length;
    await api.addCategory({ name, color, sortOrder });
    await load();
  }, [categories.length, load]);

  const updateCategory = useCallback(async (id: number, data: Partial<{ name: string; color: string; sortOrder: number }>) => {
    await api.updateCategory(id, data);
    await load();
  }, [load]);

  const deleteCategory = useCallback(async (id: number) => {
    await api.deleteCategory(id);
    await load();
  }, [load]);

  const moveCategoryUp = useCallback(async (id: number) => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(c => c.id === id);
    if (idx <= 0) return;
    await api.updateCategory(sorted[idx].id, { sortOrder: sorted[idx - 1].sortOrder });
    await api.updateCategory(sorted[idx - 1].id, { sortOrder: sorted[idx].sortOrder });
    await load();
  }, [categories, load]);

  const moveCategoryDown = useCallback(async (id: number) => {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(c => c.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    await api.updateCategory(sorted[idx].id, { sortOrder: sorted[idx + 1].sortOrder });
    await api.updateCategory(sorted[idx + 1].id, { sortOrder: sorted[idx].sortOrder });
    await load();
  }, [categories, load]);

  const addItem = useCallback(async (data: {
    categoryId: number; name: string; weightG: number; qty: number;
    worn: boolean; consumable: boolean; notes?: string;
  }) => {
    await api.addItem(data);
    await load();
  }, [load]);

  const updateItem = useCallback(async (id: number, data: Partial<{
    name: string; weightG: number; qty: number;
    worn: boolean; consumable: boolean; categoryId: number; notes: string;
  }>) => {
    await api.updateItem(id, data);
    await load();
  }, [load]);

  const deleteItem = useCallback(async (id: number) => {
    await api.deleteItem(id);
    await load();
  }, [load]);

  return {
    categories, items, loading, load,
    addCategory, updateCategory, deleteCategory, moveCategoryUp, moveCategoryDown,
    addItem, updateItem, deleteItem,
  };
}
