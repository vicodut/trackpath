import { useState, useCallback } from 'react';
import { MOBILE_BREAKPOINT } from '../lib/constants';

interface AddPointData {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  message?: string | null;
  tag?: string | null;
}

export function useAddPoint(
  addPointFn: (data: AddPointData) => Promise<boolean>,
  isAdmin: boolean,
) {
  const [formOpen, setFormOpen] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (formOpen) {
        setPickedCoords({ lat, lng });
      } else if (isAdmin && window.innerWidth <= MOBILE_BREAKPOINT) {
        setPickedCoords({ lat, lng });
        setFormOpen(true);
        setSidebarVisible(true);
      }
    },
    [formOpen, isAdmin],
  );

  const handleLongPress = useCallback(
    (lat: number, lng: number) => {
      if (!isAdmin) return;
      setPickedCoords({ lat, lng });
      setFormOpen(true);
      setSidebarVisible(true);
    },
    [isAdmin],
  );

  const handleSubmit = useCallback(
    async (data: AddPointData) => {
      const ok = await addPointFn(data);
      if (ok) setPickedCoords(null);
      return ok;
    },
    [addPointFn],
  );

  const handleSuccess = useCallback(() => {
    setFormOpen(false);
    setPickedCoords(null);
  }, []);

  const openForm = useCallback(() => {
    setFormOpen(true);
    setSidebarVisible(true);
  }, []);

  return {
    formOpen,
    setFormOpen,
    pickedCoords,
    sidebarVisible,
    setSidebarVisible,
    handleMapClick,
    handleLongPress,
    handleSubmit,
    handleSuccess,
    openForm,
  };
}
