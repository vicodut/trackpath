import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { Header } from "./components/Header";
import { Map as TrailMap } from "./components/Map";
import type { MapHandle } from "./components/Map";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Weather } from "./components/Weather";
import { Stats } from "./components/Stats";
const AdminPage = lazy(() => import("./components/AdminPage").then(m => ({ default: m.AdminPage })));
const StatsPage = lazy(() => import("./components/StatsPage").then(m => ({ default: m.StatsPage })));
const GearPage = lazy(() => import("./components/GearPage").then(m => ({ default: m.GearPage })));
const TrailLogPage = lazy(() => import("./components/TrailLogPage").then(m => ({ default: m.TrailLogPage })));
const Blog = lazy(() => import("./components/Blog").then(m => ({ default: m.Blog })));
const PollsPage = lazy(() => import("./components/PollsPage").then(m => ({ default: m.PollsPage })));
const ResourcesPage = lazy(() => import("./components/ResourcesPage").then(m => ({ default: m.ResourcesPage })));
const CheersPage = lazy(() => import("./components/CheersPage").then(m => ({ default: m.CheersPage })));
import { LocationBanner } from "./components/LocationBanner";
import { PoopRain } from "./components/PoopRain";
import type { LayerVisibility } from "./components/LayerToggle";
import { LayerToggle } from "./components/LayerToggle";
import { MapElevationProfile } from "./components/MapElevationProfile";
import { PointPopup } from "./components/PointPopup";
import { usePoints } from "./hooks/usePoints";
import { useAdmin } from "./hooks/useAdmin";
import { useStrava } from "./hooks/useStrava";
import { usePolls } from "./hooks/usePolls";
import { useCheers } from "./hooks/useCheers";
import { useModals } from "./hooks/useModals";
import { useAddPoint } from "./hooks/useAddPoint";
import type { TrailSegment } from "./hooks/useTrailDistance";
import { useTrailDistance } from "./hooks/useTrailDistance";
import type { TrackingPoint } from "./types";
import { haversine } from "./lib/geo";

export function App() {
  const { points, loading, status, sync, addPoint, removePoint, totalDistanceKm, totalElevationGain } = usePoints();
  const { isAdmin } = useAdmin();
  const { activities: stravaActivities, connect: stravaConnect, syncActivities: stravaSync } = useStrava();
  const { polls, suggestions, vote: votePoll, create: createPoll, close: closePoll, remove: deletePoll, suggest: suggestPoll, loadSuggestions, accept: acceptSuggestion, reject: rejectSuggestion } = usePolls();
  const { cheers, submit: submitCheer, remove: deleteCheer } = useCheers(isAdmin);
  const { showAdmin, showStats, showTrailLog, showBlog, showGear, showPolls, showResources, showCheers, openAdmin, openStats, openTrailLog, openBlog, openGear, openPolls, openResources, openCheers, closeModal } = useModals();
  const { formOpen, setFormOpen, pickedCoords, sidebarVisible, setSidebarVisible, handleMapClick, handleLongPress, handleSubmit, handleSuccess, openForm } = useAddPoint(addPoint, isAdmin);

  const [poopRain, setPoopRain] = useState(false);
  const triggerPoop = useCallback(() => {
    setPoopRain(true);
    setTimeout(() => setPoopRain(false), 3000);
  }, []);

  // Keyboard: type "poop"
  useEffect(() => {
    let buf = '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-4);
      if (buf === 'poop') { buf = ''; triggerPoop(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [triggerPoop]);

  // Mobile shake
  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') return;
    const THRESHOLD = 25;
    const COOLDOWN_MS = 2000;
    let lastShake = 0;

    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2);
      const now = Date.now();
      if (mag > THRESHOLD && now - lastShake > COOLDOWN_MS) {
        lastShake = now;
        triggerPoop();
      }
    };

    // iOS 13+ requires a user-gesture permission request
    if (typeof (DeviceMotionEvent as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      const requestOnTap = () => {
        (DeviceMotionEvent as { requestPermission: () => Promise<string> }).requestPermission()
          .then(result => { if (result === 'granted') window.addEventListener('devicemotion', onMotion); })
          .catch(() => {});
      };
      window.addEventListener('click', requestOnTap, { once: true });
      return () => {
        window.removeEventListener('click', requestOnTap);
        window.removeEventListener('devicemotion', onMotion);
      };
    }

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [triggerPoop]);

  const [selectedPoint, setSelectedPoint] = useState<TrackingPoint | null>(null);
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<MapHandle>(null);
  const [tappedPoint, setTappedPoint] = useState<TrackingPoint | null>(null);
  const [trailSegment, setTrailSegment] = useState<TrailSegment | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<{ lat: number; lon: number } | null>(null);
  const { getSegment, getTrailKm } = useTrailDistance();

  const [layers, setLayers] = useState<LayerVisibility>(() => {
    const isMobile = window.innerWidth <= 768;
    const defaults: LayerVisibility = {
      garminPath: true, garminPoints: true, strava: true, atTrail: true, weather: true, tileStyle: 'osm' as const,
      tags: { resupply: true, poop: false, hostel: true, camp: true, shelter: true, water: true, viewpoint: true },
      highlights: {
        shelter: !isMobile, summit: !isMobile, campsite: !isMobile, town: !isMobile,
        'road-crossing': !isMobile, landmark: true, 'state-border': true, 'water-source': false,
      },
    };
    try {
      const saved = localStorage.getItem('trackpath:layers');
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return defaults;
  });

  const handleLayersChange = useCallback((next: LayerVisibility) => {
    setLayers(next);
    try { localStorage.setItem('trackpath:layers', JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

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

  // 7-day pace for elevation chart projection
  const pace7dayKm = useMemo(() => {
    const garminPts = points.filter(p => !p.garminId?.startsWith('manual-'));
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = garminPts.filter(p => new Date(p.timestamp).getTime() >= sevenDaysAgo);
    if (recent.length < 2) return null;
    let dist = 0;
    for (let i = 1; i < recent.length; i++) {
      const d = haversine(recent[i-1].latitude, recent[i-1].longitude, recent[i].latitude, recent[i].longitude);
      if (d < 100) dist += d;
    }
    return dist / 7;
  }, [points]);

  const trailProgressKm = lastGarminPoint
    ? getTrailKm(lastGarminPoint.latitude, lastGarminPoint.longitude)
    : null;

  const isNighttime = useMemo(() => {
    const h = new Date().getHours();
    return h >= 21 || h < 6;
  }, []);

  const nearbyAltitudes = useMemo(() => {
    if (!tappedPoint) return [];
    const idx = points.findIndex(p => p.id === tappedPoint.id);
    if (idx === -1) return [];
    return points
      .slice(Math.max(0, idx - 10), idx + 11)
      .map(p => p.altitude)
      .filter((a): a is number => a != null);
  }, [tappedPoint, points]);

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
        onPolls={openPolls}
        onResources={openResources}
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
            <LocationBanner points={points} trailProgressKm={trailProgressKm} />
            {isNighttime && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(10,5,30,0.18)',
                pointerEvents: 'none', zIndex: 800,
              }} />
            )}
            {layers.weather && <Weather />}
            <LayerToggle layers={layers} onChange={handleLayersChange} />
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
            currentDistKm={lastGarminPoint ? getTrailKm(lastGarminPoint.latitude, lastGarminPoint.longitude) : null}
            pace7dayKm={pace7dayKm}
          />
        </div>
        {sidebarVisible && (
          <Sidebar
            points={points}
            loading={loading}
            totalDistanceKm={totalDistanceKm}
            totalElevationGain={totalElevationGain}
            trailProgressKm={trailProgressKm}
            stravaActivities={stravaActivities}
            onSelectPoint={setSelectedPoint}
            onDeletePoint={removePoint}
            onAddPoint={handleSubmit}
            onFormToggle={setFormOpen}
            onAddSuccess={handleSuccess}
            pickedCoords={pickedCoords}
            isAdmin={isAdmin}
            forceFormOpen={formOpen}
            polls={polls.slice(0, 1)}
            onVote={votePoll}
            onCreatePoll={createPoll}
            onClosePoll={closePoll}
            onDeletePoll={deletePoll}
            cheers={cheers}
            onSubmitCheer={submitCheer}
            onDeleteCheer={deleteCheer}
            onOpenCheers={openCheers}
          />
        )}
      </div>
      <StatusBar message={status.message} type={status.type} />
      <Suspense fallback={null}>
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
            polls={polls}
            onCreatePoll={createPoll}
            onClosePoll={closePoll}
            onDeletePoll={deletePoll}
            suggestions={suggestions}
            onLoadSuggestions={loadSuggestions}
            onAcceptSuggestion={acceptSuggestion}
            onRejectSuggestion={rejectSuggestion}
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
        {showBlog && <Blog onClose={closeModal} />}
        {showGear && <GearPage isAdmin={isAdmin} onClose={closeModal} />}
        {showCheers && (
          <CheersPage
            cheers={cheers}
            isAdmin={isAdmin}
            onDelete={deleteCheer}
            onClose={closeModal}
          />
        )}
        {showResources && (
          <ResourcesPage
            trailProgressKm={trailProgressKm}
            onClose={closeModal}
          />
        )}
        {showPolls && (
          <PollsPage
            polls={polls}
            isAdmin={isAdmin}
            onVote={votePoll}
            onSuggest={suggestPoll}
            onClose={closeModal}
          />
        )}
      </Suspense>
      {poopRain && <PoopRain />}
      {tappedPoint && (
        <PointPopup
          point={tappedPoint}
          trailDistanceKm={trailSegment?.distanceKm ?? null}
          trailElevationGain={trailSegment?.elevationGain ?? null}
          nearbyAltitudes={nearbyAltitudes}
          onClose={handlePointClose}
        />
      )}
    </div>
  );
}
