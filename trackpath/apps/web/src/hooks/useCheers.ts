import { useState, useEffect, useCallback } from 'react';
import { fetchCheers, fetchAllCheers, createCheer, deleteCheer } from '../api/cheers';
import type { Cheer } from '../api/cheers';

export function useCheers(isAdmin: boolean) {
  const [cheers, setCheers] = useState<Cheer[]>([]);

  const load = useCallback(async () => {
    try {
      const data = isAdmin ? await fetchAllCheers() : await fetchCheers();
      setCheers(data);
    } catch { /* ignore */ }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (name: string, message: string, isPublic: boolean) => {
    try {
      const cheer = await createCheer({ name, message, isPublic });
      // optimistically add — reload to get accurate list
      setCheers(prev => [cheer, ...prev]);
      return true;
    } catch { return false; }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await deleteCheer(id);
      setCheers(prev => prev.filter(c => c.id !== id));
    } catch { /* ignore */ }
  }, []);

  return { cheers, submit, remove };
}
