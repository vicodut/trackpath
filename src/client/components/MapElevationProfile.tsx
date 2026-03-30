import { useEffect, useState, useCallback } from 'react';

interface TrailElevationPoint {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
}

interface MapElevationProfileProps {
  onHover: (lat: number, lon: number) => void;
  onHoverEnd: () => void;
}

const CHART_HEIGHT = 120;
const CHART_PADDING = { top: 12, right: 12, bottom: 22, left: 42 };

export function MapElevationProfile({ onHover, onHoverEnd }: MapElevationProfileProps) {
  const [trailData, setTrailData] = useState<TrailElevationPoint[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<{ elevation: number; dist: number; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch('/at-trail-elevation.json')
      .then(res => res.json())
      .then(setTrailData)
      .catch(() => setTrailData(null));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!trailData || trailData.length < 2) return;

    const maxDist = trailData[trailData.length - 1].distanceKm;
    const w = 800;
    const { left } = CHART_PADDING;
    const plotW = w - left - CHART_PADDING.right;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * w;
    const dist = ((mx - left) / plotW) * maxDist;

    let closest = trailData[0];
    let minD = Infinity;
    for (const p of trailData) {
      const d = Math.abs(p.distanceKm - dist);
      if (d < minD) { minD = d; closest = p; }
    }

    setHovered({
      elevation: closest.elevation,
      dist: closest.distanceKm,
      x: e.clientX,
      y: e.clientY,
    });

    onHover?.(closest.lat, closest.lon);
  }, [trailData, onHover]);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    onHoverEnd();
  }, [onHoverEnd]);

  if (!trailData || trailData.length < 2) return null;

  const maxDist = trailData[trailData.length - 1].distanceKm;
  const elevations = trailData.map(p => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  const w = 800;
  const h = CHART_HEIGHT;
  const { top, right, bottom, left } = CHART_PADDING;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const toX = (dist: number) => left + (dist / maxDist) * plotW;
  const toY = (elev: number) => top + plotH - ((elev - minElev) / elevRange) * plotH;

  const pathD = trailData.map((p, i) => {
    const x = toX(p.distanceKm);
    const y = toY(p.elevation);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const areaD = pathD + ` L${toX(maxDist)},${top + plotH} L${left},${top + plotH} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minElev + (elevRange * i) / (yTicks - 1))
  );

  const xTicks = 6;
  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    Math.round((maxDist * i) / (xTicks - 1))
  );

  return (
    <div className={`map-elev-profile ${collapsed ? 'map-elev-profile--collapsed' : ''}`}>
      <button
        className="map-elev-toggle"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Show elevation profile' : 'Hide elevation profile'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {collapsed
            ? <polyline points="18 15 12 9 6 15" />
            : <polyline points="6 9 12 15 18 9" />
          }
        </svg>
        <span>ELEVATION</span>
      </button>
      {!collapsed && (
        <div className="map-elev-chart">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="map-elev-svg"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid lines */}
            {yTickValues.map(v => (
              <line key={`yg-${v}`} x1={left} x2={w - right} y1={toY(v)} y2={toY(v)} stroke="var(--outline-variant)" strokeWidth="0.5" opacity="0.3" />
            ))}
            {/* Filled area */}
            <path d={areaD} fill="url(#mapElevGrad)" />
            {/* Line */}
            <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="1.5" />
            {/* Gradient */}
            <defs>
              <linearGradient id="mapElevGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Y-axis labels */}
            {yTickValues.map(v => (
              <text key={`yl-${v}`} x={left - 4} y={toY(v) + 3} textAnchor="end" className="map-elev-label">{v}m</text>
            ))}
            {/* X-axis labels */}
            {xTickValues.map(v => (
              <text key={`xl-${v}`} x={toX(v)} y={h - 4} textAnchor="middle" className="map-elev-label">{v}km</text>
            ))}
            {/* Hover crosshair */}
            {hovered && (
              <>
                <line x1={toX(hovered.dist)} x2={toX(hovered.dist)} y1={top} y2={top + plotH} stroke="var(--secondary)" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
                <circle cx={toX(hovered.dist)} cy={toY(hovered.elevation)} r="4" fill="var(--secondary)" />
              </>
            )}
          </svg>
          {hovered && (
            <div
              className="map-elev-tooltip"
              style={{
                position: 'fixed',
                left: hovered.x,
                top: hovered.y - 12,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <strong>{Math.round(hovered.elevation)}m</strong>
              <span>{hovered.dist.toFixed(1)} km</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
