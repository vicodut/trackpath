import { useEffect, useState, useMemo, useCallback } from 'react';
import { CopyCoords } from '../CopyCoords';
import L from 'leaflet';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { LayerVisibility } from '../LayerToggle';
import type { TrailSegment } from '../../hooks/useTrailDistance';
import { useIsMobile } from '../../hooks/useIsMobile';
import { colors } from '../../theme';

interface Highlight {
  id: string;
  category: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
  description?: string;
}

const HIGHLIGHT_EMOJIS: Record<string, string> = {
  shelter: '🛖',
  summit: '🏔️',
  campsite: '⛺',
  town: '🏘️',
  'road-crossing': '🛣️',
  landmark: '⭐',
  'state-border': '🚩',
  'water-source': '💧',
};

function getZoomThresholds(isMobile: boolean): Record<string, number> {
  return {
    landmark: isMobile ? 8 : 6,
    'state-border': isMobile ? 9 : 7,
    summit: isMobile ? 11 : 9,
    town: isMobile ? 11 : 9,
    shelter: isMobile ? 12 : 10,
    campsite: isMobile ? 12 : 10,
    'road-crossing': isMobile ? 13 : 11,
    'water-source': isMobile ? 14 : 12,
  };
}

const iconCache = new Map<string, L.DivIcon>();

function getHighlightIcon(category: string): L.DivIcon {
  if (iconCache.has(category)) return iconCache.get(category)!;
  const emoji = HIGHLIGHT_EMOJIS[category] || '📍';
  const icon = L.divIcon({
    className: '',
    html: `<div style="font-size:20px;line-height:1;opacity:0.85;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.4));">${emoji}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  iconCache.set(category, icon);
  return icon;
}

interface HighlightsLayerProps {
  layers: LayerVisibility;
  onHighlightTap?: (lat: number, lon: number) => void;
  onHighlightClose?: () => void;
  trailSegment?: TrailSegment | null;
}

export function HighlightsLayer({ layers, onHighlightTap, onHighlightClose, trailSegment }: HighlightsLayerProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [zoom, setZoom] = useState(6);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const map = useMap();
  const isMobile = useIsMobile();
  const zoomThresholds = useMemo(() => getZoomThresholds(isMobile), [isMobile]);

  useEffect(() => {
    fetch('/at-highlights.json')
      .then(res => res.json())
      .then(setHighlights)
      .catch(() => { setHighlights([]); });
  }, []);

  const updateView = useCallback(() => {
    setZoom(map.getZoom());
    setBounds(map.getBounds());
  }, [map]);

  useEffect(() => {
    updateView();
  }, [updateView]);

  useMapEvents({
    zoomend: updateView,
    moveend: updateView,
  });

  // Filter by category toggle, zoom threshold, and viewport bounds
  const visible = useMemo(() => {
    if (!bounds || highlights.length === 0) return [];
    // Pad bounds slightly to avoid pop-in at edges
    const padded = bounds.pad(0.1);
    return highlights.filter(h => {
      if (!layers.highlights[h.category]) return false;
      const threshold = zoomThresholds[h.category] ?? 10;
      if (zoom < threshold) return false;
      if (!padded.contains([h.lat, h.lon])) return false;
      return true;
    });
  }, [highlights, layers.highlights, zoom, bounds, zoomThresholds]);

  if (visible.length === 0) return null;

  return (
    <>
      {visible.map(h => (
        <Marker
          key={h.id}
          position={[h.lat, h.lon]}
          icon={getHighlightIcon(h.category)}
          eventHandlers={{
            ...(onHighlightTap ? { click: () => { onHighlightTap(h.lat, h.lon); } } : {}),
            ...(onHighlightClose ? { popupclose: () => { onHighlightClose(); } } : {}),
          }}
        >
          <Popup>
            <strong>{h.name}</strong>
            <br />
            <CopyCoords lat={h.lat} lon={h.lon} />
            {h.elevation != null && (
              <>
                <br />
                {Math.round(h.elevation)}m
              </>
            )}
            {h.description && (
              <>
                <br />
                <em>{h.description}</em>
              </>
            )}
            {trailSegment && trailSegment.distanceKm > 0 && (
              <>
                <br />
                <strong style={{ color: colors.secondary }}>
                  {trailSegment.distanceKm.toFixed(1)} km · +{Math.round(trailSegment.elevationGain)}m
                </strong>
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
