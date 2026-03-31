import { useState, useCallback, useEffect } from "react";
import { Header } from "./components/Header";
import { Map } from "./components/Map";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Weather } from "./components/Weather";
import { Stats } from "./components/Stats";
import { AdminPage } from "./components/AdminPage";
import { StatsPage } from "./components/StatsPage";
import { LayerToggle, LayerVisibility } from "./components/LayerToggle";
import { MapElevationProfile } from "./components/MapElevationProfile";
import { PointPopup } from "./components/PointPopup";
import { TrailLogPage } from "./components/TrailLogPage";
import { usePoints } from "./hooks/usePoints";
import { useSession } from "./lib/auth-client";
import { TrackingPoint, StravaActivity } from "./types";

export function App() {
  const {
    points,
    status,
    sync,
    addPoint,
    removePoint,
    totalDistanceKm,
    totalElevationGain,
  } = usePoints();
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setIsAdmin(d.isAdmin));
    } else {
      setIsAdmin(false);
    }
  }, [session]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>(
    [],
  );
  const [stravaConnected, setStravaConnected] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<TrackingPoint | null>(
    null,
  );
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTrailLog, setShowTrailLog] = useState(false);
  const [elevationCursor, setElevationCursor] = useState<{ lat: number; lon: number } | null>(null);
  const [tappedPoint, setTappedPoint] = useState<TrackingPoint | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>({
    garminPath: true,
    garminPoints: true,
    strava: true,
    atTrail: true,
    weather: true,
    tags: {
      resupply: true,
      poop: true,
      hostel: true,
      camp: true,
      shelter: true,
      water: true,
      viewpoint: true,
    },
    highlights: {
      shelter: window.innerWidth > 768,
      summit: window.innerWidth > 768,
      campsite: window.innerWidth > 768,
      town: window.innerWidth > 768,
      'road-crossing': window.innerWidth > 768,
      landmark: true,
      'state-border': true,
    },
  });

  useEffect(() => {
    fetch("/api/strava/status")
      .then((r) => r.json())
      .then((d) => setStravaConnected(d.connected));
    fetch("/api/strava/activities")
      .then((r) => r.json())
      .then(setStravaActivities)
      .catch(() => {});
  }, []);

  const handleStravaConnect = useCallback(async () => {
    const res = await fetch("/api/strava/connect", { credentials: "include" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error("Strava connect error:", data);
    }
  }, []);

  const handleStravaSync = useCallback(async () => {
    const res = await fetch("/api/strava/sync", { method: "POST" });
    const data = await res.json();
    if (data.activities) setStravaActivities(data.activities);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  }, [sync]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (addFormOpen) {
        setPickedCoords({ lat, lng });
      } else if (isAdmin && window.innerWidth <= 768) {
        setPickedCoords({ lat, lng });
        setAddFormOpen(true);
        setSidebarVisible(true);
      }
    },
    [addFormOpen, isAdmin],
  );

  const handleLongPress = useCallback(
    (lat: number, lng: number) => {
      if (!isAdmin) return;
      setPickedCoords({ lat, lng });
      setAddFormOpen(true);
      setSidebarVisible(true);
    },
    [isAdmin],
  );

  const handleAddPoint = useCallback(
    async (data: {
      latitude: number;
      longitude: number;
      altitude?: number | null;
      message?: string | null;
      tag?: string | null;
    }) => {
      const ok = await addPoint(data);
      if (ok) {
        setPickedCoords(null);
      }
      return ok;
    },
    [addPoint],
  );

  const handleAddSuccess = useCallback(() => {
    setAddFormOpen(false);
    setPickedCoords(null);
  }, []);

  return (
    <div className="app">
      <Header
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        isAdmin={isAdmin}
        onAdmin={() => setShowAdmin(true)}
        onStats={() => setShowStats(true)}
        onTrailLog={() => setShowTrailLog(true)}
      />
      <div className="main-container">
        <div className="map-wrapper">
          <div className="map-area">
            <Map
              points={points}
              stravaActivities={stravaActivities}
              selectedPoint={selectedPoint}
              pickingFromMap={addFormOpen}
              onMapClick={handleMapClick}
              onLongPress={handleLongPress}
              onPointTap={setTappedPoint}
              onAddPoint={() => { setAddFormOpen(true); setSidebarVisible(true); }}
              sidebarVisible={sidebarVisible}
              layers={layers}
              isAdmin={isAdmin}
              elevationCursor={elevationCursor}
            />
            {layers.weather && <Weather />}
            <LayerToggle layers={layers} onChange={setLayers} />
            <Stats
              points={points}
              stravaActivities={stravaActivities}
              totalDistanceKm={totalDistanceKm}
              totalElevationGain={totalElevationGain}
            />
          </div>
          <MapElevationProfile
            onHover={(lat, lon) => setElevationCursor({ lat, lon })}
            onHoverEnd={() => setElevationCursor(null)}
          />
        </div>
        {sidebarVisible && (
          <Sidebar
            points={points}
            totalDistanceKm={totalDistanceKm}
            totalElevationGain={totalElevationGain}
            stravaActivities={stravaActivities}
            onSelectPoint={setSelectedPoint}
            onDeletePoint={removePoint}
            onAddPoint={handleAddPoint}
            onFormToggle={setAddFormOpen}
            onAddSuccess={handleAddSuccess}
            pickedCoords={pickedCoords}
            isAdmin={isAdmin}
            forceFormOpen={addFormOpen}
          />
        )}
      </div>
      <StatusBar message={status.message} type={status.type} />
      {showStats && (
        <StatsPage
          points={points}
          stravaActivities={stravaActivities}
          totalDistanceKm={totalDistanceKm}
          totalElevationGain={totalElevationGain}
          isAdmin={isAdmin}
          onClose={() => setShowStats(false)}
        />
      )}
      {showAdmin && (
        <AdminPage
          onClose={() => setShowAdmin(false)}
          onStravaConnect={handleStravaConnect}
          onStravaSync={handleStravaSync}
          onGarminSync={handleSync}
          syncing={syncing}
        />
      )}
      {showTrailLog && (
        <TrailLogPage
          points={points}
          totalDistanceKm={totalDistanceKm}
          totalElevationGain={totalElevationGain}
          stravaActivities={stravaActivities}
          onSelectPoint={setSelectedPoint}
          onDeletePoint={removePoint}
          isAdmin={isAdmin}
          onClose={() => setShowTrailLog(false)}
        />
      )}
      {tappedPoint && (
        <PointPopup point={tappedPoint} onClose={() => setTappedPoint(null)} />
      )}
    </div>
  );
}
