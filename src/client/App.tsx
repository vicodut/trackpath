import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Map } from './components/Map';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { usePoints } from './hooks/usePoints';
import { useSession } from './lib/auth-client';
import { TrackingPoint } from './types';

export function App() {
  const { points, status, sync, addPoint, removePoint, totalDistanceKm } = usePoints();
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/me').then(r => r.json()).then(d => setIsAdmin(d.isAdmin));
    } else {
      setIsAdmin(false);
    }
  }, [session]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<TrackingPoint | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  }, [sync]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (addFormOpen) {
      setPickedCoords({ lat, lng });
    }
  }, [addFormOpen]);

  const handleAddPoint = useCallback(async (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => {
    const ok = await addPoint(data);
    if (ok) {
      setPickedCoords(null);
    }
    return ok;
  }, [addPoint]);

  return (
    <>
      <Header
        onSync={handleSync}
        syncing={syncing}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        isAdmin={isAdmin}
      />
      <div className="main-container">
        <Map
          points={points}
          selectedPoint={selectedPoint}
          pickingFromMap={addFormOpen}
          onMapClick={handleMapClick}
          sidebarVisible={sidebarVisible}
        />
        {sidebarVisible && (
          <Sidebar
            points={points}
            totalDistanceKm={totalDistanceKm}
            onSelectPoint={setSelectedPoint}
            onDeletePoint={removePoint}
            onAddPoint={handleAddPoint}
            onFormToggle={setAddFormOpen}
            pickedCoords={pickedCoords}
            isAdmin={isAdmin}
          />
        )}
      </div>
      <StatusBar message={status.message} type={status.type} />
    </>
  );
}
