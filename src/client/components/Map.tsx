import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import { TrackingPoint } from '../types';


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

interface MapProps {
  points: TrackingPoint[];
  selectedPoint: TrackingPoint | null;
  pickingFromMap: boolean;
  onMapClick: (lat: number, lng: number) => void;
  sidebarVisible: boolean;
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

export function Map({ points, selectedPoint, pickingFromMap, onMapClick, sidebarVisible }: MapProps) {
  const pathCoords: [number, number][] = points.map((p) => [p.latitude, p.longitude]);

  return (
    <MapContainer center={[37.5, -79.5]} zoom={6} id="map" style={{ flex: 1, minHeight: 0 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution="&copy; OpenStreetMap contributors"
      />
      <ATTrailLayer />

      {/* Trail endpoints */}
      <Marker position={[34.627, -84.194]} icon={flagIcon}>
        <Popup><strong>Springer Mountain, GA</strong><br />Southern terminus</Popup>
      </Marker>
      <Marker position={[45.904, -68.921]} icon={flagIcon}>
        <Popup><strong>Mt. Katahdin, ME</strong><br />Northern terminus</Popup>
      </Marker>

      {/* User path */}
      {pathCoords.length > 1 && (
        <Polyline positions={pathCoords} pathOptions={{ color: '#e94560', weight: 3, opacity: 0.9, dashArray: '6,4' }} />
      )}

      {/* Point markers */}
      {points.map((pt, idx) => {
        const isLatest = idx === points.length - 1;
        const time = new Date(pt.timestamp).toLocaleString();
        return (
          <Marker
            key={pt.id}
            position={[pt.latitude, pt.longitude]}
            icon={isLatest ? latestIcon : pointIcon}
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

      <MapClickHandler picking={pickingFromMap} onClick={onMapClick} />
      <FlyToPoint point={selectedPoint} />
      <InvalidateOnResize sidebarVisible={sidebarVisible} />
    </MapContainer>
  );
}
