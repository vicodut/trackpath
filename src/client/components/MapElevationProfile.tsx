import { useEffect, useState, useCallback, useRef } from 'react';

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
const GOAL_KM = 1300;

export function MapElevationProfile({ onHover, onHoverEnd }: MapElevationProfileProps) {
  const [trailData, setTrailData] = useState<TrailElevationPoint[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<{ elevation: number; dist: number; x: number; y: number } | null>(null);
  const [svgWidth, setSvgWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/at-trail-elevation.json')
      .then(res => res.json())
      .then(setTrailData)
      .catch(() => setTrailData(null));
  }, []);

  useEffect(() => {
    if (collapsed || !containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSvgWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [collapsed]);

  const svgRef = useRef<SVGSVGElement>(null);

  const updateHover = useCallback((clientX: number, clientY: number) => {
    if (!trailData || trailData.length < 2 || !svgRef.current) return;

    const maxDist = trailData[trailData.length - 1].distanceKm;
    const { left } = CHART_PADDING;
    const plotW = svgWidth - left - CHART_PADDING.right;

    const rect = svgRef.current.getBoundingClientRect();
    const mx = clientX - rect.left;
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
      x: clientX,
      y: clientY,
    });

    onHover?.(closest.lat, closest.lon);
  }, [trailData, onHover, svgWidth]);

  const clearHover = useCallback(() => {
    setHovered(null);
    onHoverEnd();
  }, [onHoverEnd]);

  // Touch handlers for mobile drag
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || collapsed) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      updateHover(t.clientX, t.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      updateHover(t.clientX, t.clientY);
    };

    const onTouchEnd = () => {
      clearHover();
    };

    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', onTouchEnd);
    svg.addEventListener('touchcancel', onTouchEnd);

    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', onTouchEnd);
      svg.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [collapsed, updateHover, clearHover]);

  if (!trailData || trailData.length < 2) return null;

  const maxDist = trailData[trailData.length - 1].distanceKm;
  const elevations = trailData.map(p => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  const w = svgWidth;
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
        <div className="map-elev-chart" ref={containerRef}>
          <svg
            ref={svgRef}
            style={{ width: '100%', height: h, touchAction: 'none' }}
            viewBox={`0 0 ${w} ${h}`}
            className="map-elev-svg"
            onMouseMove={(e) => updateHover(e.clientX, e.clientY)}
            onMouseLeave={clearHover}
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
            {/* Goal line */}
            {GOAL_KM <= maxDist && (
              <line x1={toX(GOAL_KM)} x2={toX(GOAL_KM)} y1={top} y2={top + plotH} stroke="var(--error)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7" />
            )}
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
