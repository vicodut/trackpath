import { useState, useCallback, useMemo, useRef } from "react";
import { Header } from "./components/Header";
import { Map as TrailMap } from "./components/Map";
import type { MapHandle } from "./components/Map";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Weather } from "./components/Weather";
import { Stats } from "./components/Stats";
import { AdminPage } from "./components/AdminPage";
import { StatsPage } from "./components/StatsPage";
import { GearPage } from "./components/GearPage";
import type { LayerVisibility } from "./components/LayerToggle";
import { LayerToggle } from "./components/LayerToggle";
import { MapElevationProfile } from "./components/MapElevationProfile";
import { PointPopup } from "./components/PointPopup";
import { TrailLogPage } from "./components/TrailLogPage";
import { Blog } from "./components/Blog";
import { usePoints } from "./hooks/usePoints";
import { useAdmin } from "./hooks/useAdmin";
import { useStrava } from "./hooks/useStrava";
import { useModals } from "./hooks/useModals";
import { useAddPoint } from "./hooks/useAddPoint";
import type { TrailSegment } from "./hooks/useTrailDistance";
import { useTrailDistance } from "./hooks/useTrailDistance";
import type { TrackingPoint } from "./types";

export function App() {
  const { points, loading, status, sync, addPoint, removePoint, totalDistanceKm, totalElevationGain } = usePoints();
  const { isAdmin } = useAdmin();
  const { activities: stravaActivities, connect: stravaConnect, syncActivities: stravaSync } = useStrava();
  const { showAdmin, showStats, showTrailLog, showBlog, showGear, openAdmin, openStats, openTrailLog, openBlog, openGear, closeModal } = useModals();
  const { formOpen, setFormOpen, pickedCoords, sidebarVisible, setSidebarVisible, handleMapClick, handleLongPress, handleSubmit, handleSuccess, openForm } = useAddPoint(addPoint, isAdmin);

  const [selectedPoint, setSelectedPoint] = useState<TrackingPoint | null>(null);
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const [tappedPoint, setTappedPoint] = useState<TrackingPoint | null>(null);
  const [trailSegment, setTrailSegment] = useState<TrailSegment | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<{ lat: number; lon: number } | null>(null);
  const { getSegment, getTrailKm } = useTrailDistance();

  const [layers, setLayers] = useState<LayerVisibility>({
    garminPath: true,
    garminPoints: true,
    strava: true,
    atTrail: true,
    weather: true,
    tags: {
      resupply: true, poop: true, hostel: true, camp: true,
      shelter: true, water: true, viewpoint: true,
    },
    highlights: {
      shelter: window.innerWidth > 768,
      summit: window.innerWidth > 768,
      campsite: window.innerWidth > 768,
      town: window.innerWidth > 768,
      'road-crossing': window.innerWidth > 768,
      landmark: true,
      'state-border': true,
      'water-source': false,
    },
  });

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await sync();
    setSyncing(false);
  }, [sync]);

  // Trail distance selection
  const lastGarminPoint = points.filter(p => !p.garminId?.startsWith('manual-')).at(-1);

  const handlePointSelect = useCallback((pt: TrackingPoint) => {
    setTappedPoint(pt);
    if (lastGarminPoint) {
      setTrailSegment(getSegment(lastGarminPoint.latitude, lastGarminPoint.longitude, pt.latitude, pt.longitude));
    }
  }, [lastGarminPoint, getSegment]);

  const handlePointClose = useCallback(() => {
    setTappedPoint(null);
    setTrailSegment(null);
    setHighlightTarget(null);
  }, []);

  const handleHighlightTap = useCallback((lat: number, lon: number) => {
    setHighlightTarget({ lat, lon });
    if (lastGarminPoint) {
      setTrailSegment(getSegment(lastGarminPoint.latitude, lastGarminPoint.longitude, lat, lon));
    }
  }, [lastGarminPoint, getSegment]);

  const campMarkers = useMemo(() => {
    const garminPts = points.filter(p => !p.garminId?.startsWith('manual-'));
    const byDay = new Map<string, TrackingPoint>();
    for (const pt of garminPts) {
      byDay.set(new Date(pt.timestamp).toDateString(), pt);
    }
    const markers: number[] = [];
    for (const pt of byDay.values()) {
      const km = getTrailKm(pt.latitude, pt.longitude);
      if (km != null) markers.push(km);
    }
    return markers.sort((a, b) => a - b);
  }, [points, getTrailKm]);

  const segmentMarkers = useMemo(() => {
    const target = tappedPoint || highlightTarget;
    if (!target || !lastGarminPoint) return null;
    const fromKm = getTrailKm(lastGarminPoint.latitude, lastGarminPoint.longitude);
    const toLat = 'latitude' in target ? target.latitude : target.lat;
    const toLon = 'longitude' in target ? target.longitude : target.lon;
    const toKm = getTrailKm(toLat, toLon);
    if (fromKm == null || toKm == null) return null;
    return { fromDistKm: fromKm, toDistKm: toKm };
  }, [tappedPoint, highlightTarget, lastGarminPoint, getTrailKm]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--surface)' }}>
        <span className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        isAdmin={isAdmin}
        onAdmin={openAdmin}
        onStats={openStats}
        onTrailLog={openTrailLog}
        onBlog={openBlog}
        onGear={openGear}
      />
      <div className="main-container">
        <div className="map-wrapper">
          <div className="map-area">
            <TrailMap
              ref={mapRef}
              points={points}
              stravaActivities={stravaActivities}
              selectedPoint={selectedPoint}
              pickingFromMap={formOpen}
              onMapClick={handleMapClick}
              onLongPress={handleLongPress}
              onPointTap={handlePointSelect}
              onHighlightTap={handleHighlightTap}
              onHighlightClose={handlePointClose}
              trailSegment={trailSegment}
              onAddPoint={openForm}
              sidebarVisible={sidebarVisible}
              layers={layers}
              isAdmin={isAdmin}
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
            onHover={(lat, lon) => mapRef.current?.setElevationCursor(lat, lon)}
            onHoverEnd={() => mapRef.current?.clearElevationCursor()}
            segmentMarkers={segmentMarkers}
            campMarkers={campMarkers}
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
            onAddPoint={handleSubmit}
            onFormToggle={setFormOpen}
            onAddSuccess={handleSuccess}
            pickedCoords={pickedCoords}
            isAdmin={isAdmin}
            forceFormOpen={formOpen}
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
          onClose={closeModal}
        />
      )}
      {showAdmin && (
        <AdminPage
          onClose={closeModal}
          onStravaConnect={stravaConnect}
          onStravaSync={stravaSync}
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
          onClose={closeModal}
        />
      )}
      {showBlog && (
        <Blog onClose={closeModal} />
      )}
      {showGear && (
        <GearPage isAdmin={isAdmin} onClose={closeModal} />
      )}
      {tappedPoint && (
        <PointPopup
          point={tappedPoint}
          trailDistanceKm={trailSegment?.distanceKm ?? null}
          trailElevationGain={trailSegment?.elevationGain ?? null}
          onClose={handlePointClose}
        />
      )}
    </div>
  );
}
