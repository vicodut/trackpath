import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Map } from './components/Map';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { usePoints } from './hooks/usePoints';
import { TrackingPoint } from './types';

export function App() {
  const { points, status, sync, addPoint, removePoint, totalDistanceKm } = usePoints();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<TrackingPoint | null>(null);
  const [pickingFromMap, setPickingFromMap] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  }, [sync]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (pickingFromMap) {
      setPickedCoords({ lat, lng });
      setPickingFromMap(false);
    }
  }, [pickingFromMap]);

  const handlePickFromMap = useCallback(() => {
    setPickingFromMap(true);
    setPickedCoords(null);
  }, []);

  const handleAddPoint = useCallback(async (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null }) => {
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
      />
      <div className="main-container">
        <Map
          points={points}
          selectedPoint={selectedPoint}
          pickingFromMap={pickingFromMap}
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
            onPickFromMap={handlePickFromMap}
            pickingFromMap={pickingFromMap}
            pickedCoords={pickedCoords}
          />
        )}
      </div>
      <StatusBar message={status.message} type={status.type} />
    </>
  );
}
