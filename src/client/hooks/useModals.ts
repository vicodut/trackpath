import { useState, useCallback } from 'react';

type ModalName = 'admin' | 'stats' | 'trailLog' | 'blog';

export function useModals() {
  const [open, setOpen] = useState<ModalName | null>(null);

  const show = useCallback((name: ModalName) => setOpen(name), []);
  const close = useCallback(() => setOpen(null), []);

  return {
    showAdmin: open === 'admin',
    showStats: open === 'stats',
    showTrailLog: open === 'trailLog',
    showBlog: open === 'blog',
    openAdmin: () => show('admin'),
    openStats: () => show('stats'),
    openTrailLog: () => show('trailLog'),
    openBlog: () => show('blog'),
    closeModal: close,
  };
}
