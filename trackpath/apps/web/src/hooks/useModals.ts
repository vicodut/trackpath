import { useState, useEffect, useCallback } from 'react';

type Route = '/' | '/stats' | '/trail-log' | '/blog' | '/admin' | '/gear';

export function useModals() {
  const [path, setPath] = useState<string>(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: Route) => {
    history.pushState(null, '', to);
    setPath(to);
  }, []);

  const closeModal = useCallback(() => navigate('/'), [navigate]);

  return {
    showAdmin:    path === '/admin',
    showStats:    path === '/stats',
    showTrailLog: path === '/trail-log',
    showBlog:     path === '/blog',
    showGear:     path === '/gear',
    openAdmin:    () => navigate('/admin'),
    openStats:    () => navigate('/stats'),
    openTrailLog: () => navigate('/trail-log'),
    openBlog:     () => navigate('/blog'),
    openGear:     () => navigate('/gear'),
    closeModal,
  };
}
