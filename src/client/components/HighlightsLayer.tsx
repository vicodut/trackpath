import { useEffect, useState } from 'react';
import L from 'leaflet';
import { Marker, Popup, useMapEvents } from 'react-leaflet';
import { LayerVisibility } from './LayerToggle';

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
};

// Minimum zoom level to show each category
const ZOOM_THRESHOLDS: Record<string, number> = {
  landmark: 6,
  'state-border': 7,
  summit: 9,
  town: 9,
  shelter: 10,
  campsite: 10,
  'road-crossing': 11,
};

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
}

export function HighlightsLayer({ layers }: HighlightsLayerProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [zoom, setZoom] = useState(6);

  useEffect(() => {
    fetch('/at-highlights.json')
      .then(res => res.json())
      .then(setHighlights)
      .catch(() => setHighlights([]));
  }, []);

  useMapEvents({
    zoomend(e) {
      setZoom(e.target.getZoom());
    },
  });

  if (highlights.length === 0) return null;

  return (
    <>
      {highlights.map(h => {
        if (!layers.highlights[h.category]) return null;
        const threshold = ZOOM_THRESHOLDS[h.category] ?? 10;
        if (zoom < threshold) return null;

        return (
          <Marker
            key={h.id}
            position={[h.lat, h.lon]}
            icon={getHighlightIcon(h.category)}
          >
            <Popup>
              <strong>{h.name}</strong>
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
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
