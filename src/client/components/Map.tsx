import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import { TrackingPoint, StravaActivity } from '../types';
import { LayerVisibility } from './LayerToggle';


const pointIcon = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;background:#e94560;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(233,69,96,0.6);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const latestIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;background:#e94560;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(233,69,96,0.8);animation:pulse 2s infinite;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const flagIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">🏁</div>',
  iconSize: [28, 28],
  iconAnchor: [4, 28],
});

const TAG_EMOJIS: Record<string, string> = {
  poop: '💩',
  resupply: '🛒',
  hostel: '🏠',
  camp: '⛺',
  shelter: '🛖',
  water: '💧',
  viewpoint: '👀',
};

function getTagIcon(tag: string) {
  const emoji = TAG_EMOJIS[tag];
  if (!emoji) return null;
  return L.divIcon({
    className: '',
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
  sidebarVisible: boolean;
  layers: LayerVisibility;
}

function ATTrailLayer() {
  const [trailCoords, setTrailCoords] = useState<[number, number][]>([]);

  useEffect(() => {
    fetch('/at-trail.json')
      .then((res) => res.json())
      .then((coords: [number, number][]) => setTrailCoords(coords))
      .catch((err) => console.error('Failed to load AT trail:', err));
  }, []);

  if (trailCoords.length === 0) return null;

  return <Polyline positions={trailCoords} pathOptions={{ color: '#e94560', weight: 3, opacity: 0.6 }} />;
}

function MapClickHandler({ picking, onClick }: { picking: boolean; onClick: (lat: number, lng: number) => void }) {
  const map = useMap();

  useEffect(() => {
    map.getContainer().style.cursor = picking ? 'crosshair' : '';
  }, [picking, map]);

  useMapEvents({
    click(e) {
      if (picking) {
        onClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return null;
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

export function Map({ points, stravaActivities, selectedPoint, pickingFromMap, onMapClick, sidebarVisible, layers }: MapProps) {
  const pathCoords: [number, number][] = points
    .filter((p) => !p.garminId?.startsWith('manual-'))
    .map((p) => [p.latitude, p.longitude]);

  return (
    <MapContainer center={[37.5, -79.5]} zoom={6} id="map" style={{ width: '100%', height: '100%' }}>
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
            <Popup><strong>Springer Mountain, GA</strong><br />Southern terminus</Popup>
          </Marker>
          <Marker position={[45.904, -68.921]} icon={flagIcon}>
            <Popup><strong>Mt. Katahdin, ME</strong><br />Northern terminus</Popup>
          </Marker>
        </>
      )}

      {/* User path */}
      {layers.garminPath && pathCoords.length > 1 && (
        <Polyline positions={pathCoords} pathOptions={{ color: '#e94560', weight: 3, opacity: 0.9, dashArray: '6,4' }} />
      )}

      {/* Point markers */}
      {points.map((pt, idx) => {
        const isTag = pt.eventType && pt.eventType !== 'manual' && getTagIcon(pt.eventType);
        if (isTag && !layers.tags[pt.eventType!]) return null;
        if (!isTag && !layers.garminPoints) return null;

        const isLatest = idx === points.length - 1;
        const time = new Date(pt.timestamp).toLocaleString();
        return (
          <Marker
            key={pt.id}
            position={[pt.latitude, pt.longitude]}
            icon={(pt.eventType && getTagIcon(pt.eventType)) || (isLatest ? latestIcon : pointIcon)}
            zIndexOffset={isLatest ? 1000 : 0}
          >
            <Popup>
              <strong>{time}</strong><br />
              {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
              {pt.altitude && <><br />Alt: {pt.altitude.toFixed(0)}m</>}
              {pt.velocity ? <><br />Speed: {pt.velocity} km/h</> : pt.calculatedSpeedKmh ? <><br />Speed: ~{pt.calculatedSpeedKmh.toFixed(1)} km/h</> : null}
              {pt.message && <><br /><em>{pt.message}</em></>}
            </Popup>
          </Marker>
        );
      })}

      {/* Strava activities */}
      {layers.strava && stravaActivities.map((act) => {
        if (!act.coords) return null;
        const coords: [number, number][] = JSON.parse(act.coords);
        if (coords.length === 0) return null;
        const date = act.startDate ? new Date(act.startDate).toLocaleDateString() : '';
        const dist = act.distance ? (act.distance / 1000).toFixed(1) : '?';
        const duration = act.movingTime ? formatDuration(act.movingTime) : '';
        return (
          <Polyline
            key={act.id}
            positions={coords}
            pathOptions={{ color: '#ff8c00', weight: 4, opacity: 0.8 }}
          >
            <Popup>
              <strong>{act.name}</strong><br />
              {date} — {act.type}<br />
              {dist} km — {duration}
            </Popup>
          </Polyline>
        );
      })}

      <MapClickHandler picking={pickingFromMap} onClick={onMapClick} />
      <FlyToPoint point={selectedPoint} />
      <InvalidateOnResize sidebarVisible={sidebarVisible} />
    </MapContainer>
  );
}
