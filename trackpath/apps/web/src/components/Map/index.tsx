import { useEffect, useState, useRef, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { TrackingPoint, StravaActivity } from "../../types";
import type { LayerVisibility } from "../LayerToggle";
import { HighlightsLayer } from "../HighlightsLayer";
import { colors } from "../../theme";
import { formatDuration } from "../../lib/format";
import { useIsMobile } from "../../hooks/useIsMobile";
import { TAG_EMOJIS } from "../../lib/constants";
import type { TrailSegment } from "../../hooks/useTrailDistance";
import styles from "./Map.module.css";
import { CopyCoords } from "../CopyCoords";

const pointIcon = L.divIcon({
  className: "",
  html: `<div style="width:12px;height:12px;background:${colors.secondary};border:2px solid ${colors.onSurface};border-radius:50%;box-shadow:0 0 6px rgba(254,107,0,0.6);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const makeLatestIcon = (fart: boolean) => L.divIcon({
  className: "",
  html: `<div style="position:relative;width:60px;height:60px;">
    <div class="current-pos-pulse"></div>
    <img src="${fart ? '/sasquatch_fart.gif' : '/sasquatch.gif'}" style="width:60px;height:60px;image-rendering:pixelated;filter:drop-shadow(0 0 6px rgba(254,107,0,0.6));" />
  </div>`,
  iconSize: [60, 60],
  iconAnchor: [30, 60],
});

const flagIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">🏁</div>',
  iconSize: [28, 28],
  iconAnchor: [4, 28],
});

const airplaneIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">✈️</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});


const STRAVA_COLORS: Record<string, string> = {
  Hike:        '#fe6b00',
  Run:         '#f0c040',
  Walk:        '#52c96e',
  Ride:        '#52b0c9',
  VirtualRide: '#a078d8',
  Swim:        '#5ab4f0',
};
function getStravaColor(type: string | null): string {
  return (type && STRAVA_COLORS[type]) ?? colors.strava;
}

function getTagIcon(tag: string) {
  const emoji = TAG_EMOJIS[tag];
  if (!emoji) return null;
  return L.divIcon({
    className: "",
    html: `<div style="font-size:32px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export interface MapHandle {
  setElevationCursor: (lat: number, lon: number) => void;
  clearElevationCursor: () => void;
}

interface MapProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  selectedPoint: TrackingPoint | null;
  pickingFromMap: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onLongPress: (lat: number, lng: number) => void;
  onPointTap?: (point: TrackingPoint) => void;
  onHighlightTap?: (lat: number, lon: number) => void;
  onHighlightClose?: () => void;
  onAddPoint?: () => void;
  trailSegment?: TrailSegment | null;
  sidebarVisible: boolean;
  layers: LayerVisibility;
  isAdmin: boolean;
}

function ATTrailLayer() {
  const [trailCoords, setTrailCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    fetch("/at-trail.json")
      .then((res) => res.json())
      .then((coords: [number, number][]) => setTrailCoords(coords))
      .catch((err) => console.error("Failed to load AT trail:", err));
  }, []);

  if (trailCoords.length === 0) return null;

  return (
    <Polyline
      positions={trailCoords}
      pathOptions={{ color: colors.trail, weight: 3, opacity: 0.7 }}
    />
  );
}

function MapClickHandler({
  picking,
  onClick,
  onLongPress,
}: {
  picking: boolean;
  onClick: (lat: number, lng: number) => void;
  onLongPress: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    map.getContainer().style.cursor = picking ? "crosshair" : "";
  }, [picking, map]);

  useEffect(() => {
    const container = map.getContainer();

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const cx = touch.clientX - rect.left;
      const cy = touch.clientY - rect.top;
      touchStart.current = { x: touch.clientX, y: touch.clientY };

      longPressTimer.current = setTimeout(() => {
        if (!touchStart.current) return;
        const point = map.containerPointToLatLng(L.point(cx, cy));
        onLongPress(point.lat, point.lng);
        touchStart.current = null;
      }, 600);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStart.current || e.touches.length !== 1) {
        cancel();
        return;
      }
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        cancel();
      }
    };

    const cancel = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStart.current = null;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", cancel);
    container.addEventListener("touchcancel", cancel);

    return () => {
      cancel();
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", cancel);
      container.removeEventListener("touchcancel", cancel);
    };
  }, [map, onLongPress]);

  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

function LocateButton() {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const markerRef = useRef<L.CircleMarker | null>(null);

  const handleLocate = useCallback(() => {
    if (locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          markerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: colors.primary,
            fillColor: colors.secondary,
            fillOpacity: 1,
            weight: 3,
          }).addTo(map);
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, locating]);

  return (
    <button
      className={styles.locateBtn}
      onClick={handleLocate}
      title="LOCATE_ME"
      disabled={locating}
    >
      {locating ? (
        <span
          className="spinner"
          style={{ margin: 0, width: 16, height: 16 }}
        />
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      )}
    </button>
  );
}

const AMICALOLA_FALLS: [number, number] = [34.5590, -84.1946];
const FART_WALK_MS = 15_000;   // normal sasquatch duration
const FART_DURATION_MS = 7_500; // fart duration
const FART_CYCLE_MS = FART_WALK_MS + FART_DURATION_MS;

function LastPositionButton({ points, fart }: { points: TrackingPoint[]; fart: boolean }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    if (points.length === 0) {
      map.setView(AMICALOLA_FALLS, 14);
      return;
    }
    const last = points[points.length - 1];
    map.setView([last.latitude, last.longitude], 14);
  }, [map, points]);

  return (
    <button className={styles.lastposBtn} onClick={handleClick} title="LAST_POSITION">
      <img
        src={fart ? "/sasquatch_fart.gif" : "/sasquatch.gif"}
        alt=""
        style={{ width: 22, height: 22, imageRendering: "pixelated" }}
      />
    </button>
  );
}

function FlyToPoint({ point }: { point: TrackingPoint | null }) {
  const map = useMap();

  useEffect(() => {
    if (point) {
      map.setView([point.latitude, point.longitude], 13);
    }
  }, [point, map]);

  return null;
}

function InvalidateOnResize({ sidebarVisible }: { sidebarVisible: boolean }) {
  const map = useMap();

  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [sidebarVisible, map]);

  return null;
}

function ElevationCursor({
  onReady,
}: {
  onReady: (set: (lat: number, lon: number) => void, clear: () => void) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    const set = (lat: number, lon: number) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        markerRef.current = L.circleMarker([lat, lon], {
          radius: 7,
          color: colors.secondary,
          fillColor: colors.secondary,
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
      }
    };
    const clear = () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
    onReady(set, clear);
    return () => { clear(); };
  }, [map, onReady]);

  return null;
}


export const Map = forwardRef<MapHandle, MapProps>(function Map({
  points,
  stravaActivities,
  selectedPoint,
  pickingFromMap,
  onMapClick,
  onLongPress,
  onPointTap,
  onHighlightTap,
  onHighlightClose,
  onAddPoint,
  trailSegment,
  sidebarVisible,
  layers,
  isAdmin,
}, ref) {
  const [selectedStravaId, setSelectedStravaId] = useState<number | null>(null);
  const [fart, setFart] = useState(false);
  const setElevCursorRef = useRef<((lat: number, lon: number) => void) | null>(null);
  const clearElevCursorRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setFart(true);
      setTimeout(() => setFart(false), FART_DURATION_MS);
    }, FART_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const shuttleCoords: [number, number][] = useMemo(() => [
    [33.6407, -84.4277], // ATL airport
    [34.5597, -84.1929], // Amicalola Falls
  ], []);

  useImperativeHandle(ref, () => ({
    setElevationCursor: (lat, lon) => setElevCursorRef.current?.(lat, lon),
    clearElevationCursor: () => clearElevCursorRef.current?.(),
  }));

  const handleElevCursorReady = useCallback(
    (set: (lat: number, lon: number) => void, clear: () => void) => {
      setElevCursorRef.current = set;
      clearElevCursorRef.current = clear;
    },
    [],
  );
  const pathCoords = useMemo<[number, number][]>(
    () => points
      .filter((p) => !p.garminId?.startsWith("manual-") && !(p.eventType && p.eventType in TAG_EMOJIS))
      .map((p) => [p.latitude, p.longitude]),
    [points],
  );

  const parsedActivities = useMemo(
    () => stravaActivities.map((a) => ({
      ...a,
      parsedCoords: a.coords ? (JSON.parse(a.coords) as [number, number][]) : [] as [number, number][],
    })),
    [stravaActivities],
  );

  return (
    <MapContainer
      center={[37.5, -79.5]}
      zoom={6}
      id="map"
      style={{ width: "100%" }}
    >
      {layers.tileStyle === 'topo' ? (
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
          attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> &copy; OpenStreetMap contributors'
        />
      ) : (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution="&copy; OpenStreetMap contributors"
        />
      )}
      {layers.atTrail && <ATTrailLayer />}
      <HighlightsLayer layers={layers} onHighlightTap={onHighlightTap} onHighlightClose={onHighlightClose} trailSegment={trailSegment} />

      {/* Trail endpoints */}
      {layers.atTrail && (
        <>
          <Marker position={[34.627, -84.194]} icon={flagIcon}>
            <Popup>
              <strong>Springer Mountain, GA</strong><br />
              Southern terminus<br />
              <CopyCoords lat={34.627} lon={-84.194} />
            </Popup>
          </Marker>
          <Marker position={[45.904, -68.921]} icon={flagIcon}>
            <Popup>
              <strong>Mt. Katahdin, ME</strong><br />
              Northern terminus<br />
              <CopyCoords lat={45.904} lon={-68.921} />
            </Popup>
          </Marker>
          {/* Airport markers */}
          <Marker position={[33.6407, -84.4277]} icon={airplaneIcon}>
            <Popup>
              <strong>ATL</strong><br />
              Hartsfield-Jackson Atlanta<br />
              <CopyCoords lat={33.6407} lon={-84.4277} />
            </Popup>
          </Marker>
          <Marker position={[38.9531, -77.4565]} icon={airplaneIcon}>
            <Popup>
              <strong>IAD</strong><br />
              Washington Dulles<br />
              <CopyCoords lat={38.9531} lon={-77.4565} />
            </Popup>
          </Marker>
          {/* Shuttle route: ATL → Amicalola Falls */}
          <Polyline
            positions={shuttleCoords}
            pathOptions={{ color: '#888888', weight: 4, opacity: 0.7, dashArray: '10,8' }}
          >
            <Popup>Atlanta airport to Amicalola Falls commute by shuttle</Popup>
          </Polyline>
        </>
      )}

      {/* User path */}
      {layers.garminPath && pathCoords.length > 1 && (
        <Polyline
          positions={pathCoords}
          pathOptions={{
            color: colors.secondary,
            weight: 3,
            opacity: 0.9,
            dashArray: "6,4",
          }}
        />
      )}

      {/* Sasquatch at Amicalola Falls when no tracking points yet */}
      {points.length === 0 && layers.garminPoints && (
        <Marker position={AMICALOLA_FALLS} icon={makeLatestIcon(fart)} zIndexOffset={1000}>
          <Popup><strong>Amicalola Falls</strong><br />Trip starts here 🥾</Popup>
        </Marker>
      )}

      {/* Point markers */}
      {points.map((pt, idx) => {
        const isTag =
          pt.eventType && pt.eventType !== "manual" && getTagIcon(pt.eventType);
        if (isTag && !layers.tags[pt.eventType!]) return null;
        if (!isTag && !layers.garminPoints) return null;

        const isLatest = idx === points.length - 1;
        const time = new Date(pt.timestamp).toLocaleString();
        return (
          <Marker
            key={pt.id}
            position={[pt.latitude, pt.longitude]}
            icon={
              (pt.eventType && getTagIcon(pt.eventType)) ||
              (isLatest ? makeLatestIcon(fart) : pointIcon)
            }
            zIndexOffset={isLatest ? 1000 : 0}
          >
            <Popup>
              <strong>{time}</strong>
              <br />
              <CopyCoords lat={pt.latitude} lon={pt.longitude} />
              {pt.altitude != null && (
                <><br />Alt: {pt.altitude.toFixed(0)}m</>
              )}
              {pt.velocity ? (
                <><br />Speed: {pt.velocity} km/h</>
              ) : pt.calculatedSpeedKmh ? (
                <><br />Speed: ~{pt.calculatedSpeedKmh.toFixed(1)} km/h</>
              ) : null}
              {pt.message && (
                <><br /><em>{pt.message}</em></>
              )}
            </Popup>
          </Marker>
        );
      })}

      {/* Strava activities */}
      {layers.strava &&
        parsedActivities.map((act) => {
          const coords = act.parsedCoords;
          if (coords.length === 0) return null;
          const date = act.startDate
            ? new Date(act.startDate).toLocaleDateString()
            : "";
          const dist = act.distance ? (act.distance / 1000).toFixed(1) : "?";
          const duration = act.movingTime ? formatDuration(act.movingTime) : "";
          const isSelected = selectedStravaId === act.id;
          return (
            <Polyline
              key={act.id}
              positions={coords}
              pathOptions={{ color: isSelected ? '#ff69b4' : getStravaColor(act.type), weight: isSelected ? 5 : 4, opacity: 0.9 }}
              eventHandlers={{ click: () => setSelectedStravaId(act.id) }}
            >
              <Popup eventHandlers={{ remove: () => setSelectedStravaId(null) }}>
                <strong>{act.name}</strong>
                <br />
                {date} — {act.type}
                <br />
                {dist} km — {duration}
                <br />
                <a href={`https://www.strava.com/activities/${act.stravaId}`} target="_blank" rel="noreferrer"
                  style={{ color: '#fc4c02', fontSize: '0.8em' }}>
                  View on Strava ↗
                </a>
              </Popup>
            </Polyline>
          );
        })}

      {/* Highlighted trail segment between last position and selected point */}
      {trailSegment && trailSegment.coords.length > 1 && (
        <Polyline
          positions={trailSegment.coords}
          pathOptions={{ color: colors.trailHighlight, weight: 5, opacity: 0.9 }}
        />
      )}

      <MapClickHandler
        picking={pickingFromMap}
        onClick={onMapClick}
        onLongPress={onLongPress}
      />
      <FlyToPoint point={selectedPoint} />
      <InvalidateOnResize sidebarVisible={sidebarVisible} />
      <div className={styles.mapControls} onClick={(e) => e.stopPropagation()}>
        {isAdmin && onAddPoint && (
          <button
            className={`${styles.mapCtrlBtn} ${styles.mapCtrlAdd}`}
            onClick={onAddPoint}
            title="Add tracking point"
          >
            +
          </button>
        )}
        <LastPositionButton points={points} fart={fart} />
        {isAdmin && <LocateButton />}
      </div>
      <ElevationCursor onReady={handleElevCursorReady} />
    </MapContainer>
  );
});
