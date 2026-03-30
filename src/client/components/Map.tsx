import { useEffect, useState, useRef, useCallback } from "react";
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
import { TrackingPoint, StravaActivity } from "../types";
import { LayerVisibility } from "./LayerToggle";

const pointIcon = L.divIcon({
  className: "",
  html: '<div style="width:12px;height:12px;background:#fe6b00;border:2px solid #d9e6d7;border-radius:50%;box-shadow:0 0 6px rgba(254,107,0,0.6);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const latestIcon = L.divIcon({
  className: "",
  html: '<img src="/sasquatch.gif" style="width:40px;height:40px;image-rendering:pixelated;filter:drop-shadow(0 0 6px rgba(254,107,0,0.6));" />',
  iconSize: [60, 60],
  iconAnchor: [30, 60],
});

const flagIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">🏁</div>',
  iconSize: [28, 28],
  iconAnchor: [4, 28],
});

const TAG_EMOJIS: Record<string, string> = {
  poop: "💩",
  resupply: "🛒",
  hostel: "🏠",
  camp: "⛺",
  shelter: "🛖",
  water: "💧",
  viewpoint: "👀",
};

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

interface MapProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  selectedPoint: TrackingPoint | null;
  pickingFromMap: boolean;
  onMapClick: (lat: number, lng: number) => void;
  onLongPress: (lat: number, lng: number) => void;
  onPointTap?: (point: TrackingPoint) => void;
  sidebarVisible: boolean;
  layers: LayerVisibility;
  isAdmin: boolean;
  elevationCursor?: { lat: number; lon: number } | null;
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
      pathOptions={{ color: "#fe6b00", weight: 3, opacity: 0.6 }}
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
            color: "#b8ccb8",
            fillColor: "#fe6b00",
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
      className="locate-btn"
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

function LastPositionButton({ points }: { points: TrackingPoint[] }) {
  const map = useMap();

  const handleClick = useCallback(() => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    map.setView([last.latitude, last.longitude], 14);
  }, [map, points]);

  if (points.length === 0) return null;

  return (
    <button className="lastpos-btn" onClick={handleClick} title="LAST_POSITION">
      <img
        src="/sasquatch.gif"
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

function ElevationCursor({ cursorPos }: { cursorPos: { lat: number; lon: number } | null }) {
  const map = useMap();
  const markerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (cursorPos) {
      if (markerRef.current) {
        markerRef.current.setLatLng([cursorPos.lat, cursorPos.lon]);
      } else {
        markerRef.current = L.circleMarker([cursorPos.lat, cursorPos.lon], {
          radius: 7,
          color: '#fe6b00',
          fillColor: '#fe6b00',
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
      }
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [cursorPos, map]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  return null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

export function Map({
  points,
  stravaActivities,
  selectedPoint,
  pickingFromMap,
  onMapClick,
  onLongPress,
  onPointTap,
  sidebarVisible,
  layers,
  isAdmin,
  elevationCursor,
}: MapProps) {
  const isMobile = window.innerWidth <= 768;
  const pathCoords: [number, number][] = points
    .filter((p) => !p.garminId?.startsWith("manual-"))
    .map((p) => [p.latitude, p.longitude]);

  return (
    <MapContainer
      center={[37.5, -79.5]}
      zoom={6}
      id="map"
      style={{ width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution="&copy; OpenStreetMap contributors"
      />
      {layers.atTrail && <ATTrailLayer />}

      {/* Trail endpoints */}
      {layers.atTrail && (
        <>
          <Marker position={[34.627, -84.194]} icon={flagIcon}>
            <Popup>
              <strong>Springer Mountain, GA</strong>
              <br />
              Southern terminus
            </Popup>
          </Marker>
          <Marker position={[45.904, -68.921]} icon={flagIcon}>
            <Popup>
              <strong>Mt. Katahdin, ME</strong>
              <br />
              Northern terminus
            </Popup>
          </Marker>
        </>
      )}

      {/* User path */}
      {layers.garminPath && pathCoords.length > 1 && (
        <Polyline
          positions={pathCoords}
          pathOptions={{
            color: "#fe6b00",
            weight: 3,
            opacity: 0.9,
            dashArray: "6,4",
          }}
        />
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
              (isLatest ? latestIcon : pointIcon)
            }
            zIndexOffset={isLatest ? 1000 : 0}
            eventHandlers={isMobile && onPointTap ? {
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                onPointTap(pt);
              },
            } : undefined}
          >
            {!isMobile && (
              <Popup>
                <strong>{time}</strong>
                <br />
                {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                {pt.altitude && (
                  <>
                    <br />
                    Alt: {pt.altitude.toFixed(0)}m
                  </>
                )}
                {pt.velocity ? (
                  <>
                    <br />
                    Speed: {pt.velocity} km/h
                  </>
                ) : pt.calculatedSpeedKmh ? (
                  <>
                    <br />
                    Speed: ~{pt.calculatedSpeedKmh.toFixed(1)} km/h
                  </>
                ) : null}
                {pt.message && (
                  <>
                    <br />
                    <em>{pt.message}</em>
                  </>
                )}
              </Popup>
            )}
          </Marker>
        );
      })}

      {/* Strava activities */}
      {layers.strava &&
        stravaActivities.map((act) => {
          if (!act.coords) return null;
          const coords: [number, number][] = JSON.parse(act.coords);
          if (coords.length === 0) return null;
          const date = act.startDate
            ? new Date(act.startDate).toLocaleDateString()
            : "";
          const dist = act.distance ? (act.distance / 1000).toFixed(1) : "?";
          const duration = act.movingTime ? formatDuration(act.movingTime) : "";
          return (
            <Polyline
              key={act.id}
              positions={coords}
              pathOptions={{ color: "#ff8c00", weight: 4, opacity: 0.8 }}
            >
              <Popup>
                <strong>{act.name}</strong>
                <br />
                {date} — {act.type}
                <br />
                {dist} km — {duration}
              </Popup>
            </Polyline>
          );
        })}

      <MapClickHandler
        picking={pickingFromMap}
        onClick={onMapClick}
        onLongPress={onLongPress}
      />
      <FlyToPoint point={selectedPoint} />
      <InvalidateOnResize sidebarVisible={sidebarVisible} />
      {isAdmin && <LocateButton />}
      <LastPositionButton points={points} />
      <ElevationCursor cursorPos={elevationCursor ?? null} />
    </MapContainer>
  );
}
