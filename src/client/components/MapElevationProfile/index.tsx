import { useEffect, useState, useCallback, useRef } from "react";
import { ICONIC_SUMMITS } from "../../data/iconic-summits";
import styles from "./MapElevationProfile.module.css";

interface TrailElevationPoint {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
}

interface SegmentMarkers {
  fromDistKm: number;
  toDistKm: number;
}

interface MapElevationProfileProps {
  onHover: (lat: number, lon: number) => void;
  onHoverEnd: () => void;
  segmentMarkers?: SegmentMarkers | null;
}

const CHART_HEIGHT = 160;
const CHART_PADDING = { top: 14, right: 14, bottom: 26, left: 48 };
const GOAL_KM = 1500;

export function MapElevationProfile({
  onHover,
  onHoverEnd,
  segmentMarkers,
}: MapElevationProfileProps) {
  const [trailData, setTrailData] = useState<TrailElevationPoint[] | null>(
    null,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<{
    elevation: number;
    dist: number;
    x: number;
    y: number;
    summitName?: string;
  } | null>(null);
  const [svgWidth, setSvgWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/at-trail-elevation.json")
      .then((res) => res.json())
      .then(setTrailData)
      .catch(() => setTrailData(null));
  }, []);

  useEffect(() => {
    if (collapsed || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        setSvgWidth(prev => prev === newWidth ? prev : newWidth);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [collapsed]);

  const svgRef = useRef<SVGSVGElement>(null);

  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      if (!trailData || trailData.length < 2 || !containerRef.current) return;

      const maxDist = trailData[trailData.length - 1].distanceKm;
      const { left } = CHART_PADDING;
      const plotW = svgWidth - left - CHART_PADDING.right;

      const rect = containerRef.current.getBoundingClientRect();
      const mx = clientX - rect.left;
      const dist = ((mx - left) / plotW) * maxDist;

      let closest = trailData[0];
      let minD = Infinity;
      for (const p of trailData) {
        const d = Math.abs(p.distanceKm - dist);
        if (d < minD) {
          minD = d;
          closest = p;
        }
      }

      const nearSummit = ICONIC_SUMMITS.find(
        (s) => Math.abs(s.distanceKm - closest.distanceKm) < maxDist * 0.015,
      );
      setHovered({
        elevation: closest.elevation,
        dist: closest.distanceKm,
        x: clientX,
        y: clientY,
        summitName: nearSummit?.name,
      });

      onHover?.(closest.lat, closest.lon);
    },
    [trailData, onHover, svgWidth],
  );

  const clearHover = useCallback(() => {
    setHovered(null);
    onHoverEnd();
  }, [onHoverEnd]);

  // Touch handlers for mobile drag (on container div, not SVG)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || collapsed) return;

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

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [collapsed, updateHover, clearHover]);

  if (!trailData || trailData.length < 2) return null;

  const maxDist = trailData[trailData.length - 1].distanceKm;
  const elevations = trailData.map((p) => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  const w = svgWidth;
  const h = CHART_HEIGHT;
  const { top, right, bottom, left } = CHART_PADDING;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const toX = (dist: number) => left + (dist / maxDist) * plotW;
  const toY = (elev: number) =>
    top + plotH - ((elev - minElev) / elevRange) * plotH;

  const pathD = trailData
    .map((p, i) => {
      const x = toX(p.distanceKm);
      const y = toY(p.elevation);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const areaD =
    pathD + ` L${toX(maxDist)},${top + plotH} L${left},${top + plotH} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minElev + (elevRange * i) / (yTicks - 1)),
  );

  const xTicks = 6;
  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    Math.round((maxDist * i) / (xTicks - 1)),
  );

  return (
    <div
      className={`${styles.mapElevProfile} ${collapsed ? styles.mapElevProfileCollapsed : ""}`}
    >
      <button
        className={styles.mapElevToggle}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Show elevation profile" : "Hide elevation profile"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {collapsed ? (
            <polyline points="18 15 12 9 6 15" />
          ) : (
            <polyline points="6 9 12 15 18 9" />
          )}
        </svg>
        <span>ELEVATION</span>
      </button>
      {!collapsed && (
        <div
          className={styles.mapElevChart}
          ref={containerRef}
          onMouseMove={(e) => updateHover(e.clientX, e.clientY)}
          onMouseLeave={clearHover}
          style={{ touchAction: "none" }}
        >
          <svg
            ref={svgRef}
            style={{ width: "100%", height: h, pointerEvents: "none" }}
            viewBox={`0 0 ${w} ${h}`}
            className={styles.mapElevSvg}
          >
            {/* Grid lines */}
            {yTickValues.map((v) => (
              <line
                key={`yg-${v}`}
                x1={left}
                x2={w - right}
                y1={toY(v)}
                y2={toY(v)}
                stroke="var(--outline-variant)"
                strokeWidth="0.5"
                opacity="0.3"
              />
            ))}
            {/* Filled area */}
            <path d={areaD} fill="url(#mapElevGrad)" />
            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--secondary)"
              strokeWidth="1.5"
            />
            {/* Gradient */}
            <defs>
              <linearGradient id="mapElevGrad" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--secondary)"
                  stopOpacity="0.3"
                />
                <stop
                  offset="100%"
                  stopColor="var(--secondary)"
                  stopOpacity="0.02"
                />
              </linearGradient>
            </defs>
            {/* Y-axis labels */}
            {yTickValues.map((v) => (
              <text
                key={`yl-${v}`}
                x={left - 4}
                y={toY(v) + 3}
                textAnchor="end"
                className={styles.mapElevLabel}
              >
                {v}m
              </text>
            ))}
            {/* X-axis labels */}
            {xTickValues.map((v) => (
              <text
                key={`xl-${v}`}
                x={toX(v)}
                y={h - 4}
                textAnchor="middle"
                className={styles.mapElevLabel}
              >
                {v}km
              </text>
            ))}
            {/* Iconic summit markers */}
            {ICONIC_SUMMITS.map((s) => {
              if (s.distanceKm > maxDist) return null;
              const sx = toX(s.distanceKm);
              const sy = toY(s.elevation);
              const active = hovered?.summitName === s.name;
              return (
                <g key={s.name} style={{ pointerEvents: "none" }}>
                  <line
                    x1={sx}
                    x2={sx}
                    y1={sy}
                    y2={top + plotH}
                    stroke={
                      active ? "var(--secondary)" : "var(--on-surface-variant)"
                    }
                    strokeWidth="0.5"
                    opacity={active ? 0.6 : 0.25}
                    strokeDasharray="2,3"
                  />
                  <polygon
                    points={`${sx},${sy - 6} ${sx - 3},${sy} ${sx + 3},${sy}`}
                    fill={
                      active ? "var(--secondary)" : "var(--on-surface-variant)"
                    }
                    opacity={active ? 1 : 0.5}
                  />
                </g>
              );
            })}
            {/* Selected segment highlight (fill + line) */}
            {segmentMarkers &&
              trailData &&
              (() => {
                const startKm = Math.min(
                  segmentMarkers.fromDistKm,
                  segmentMarkers.toDistKm,
                );
                const endKm = Math.max(
                  segmentMarkers.fromDistKm,
                  segmentMarkers.toDistKm,
                );
                const segPoints = trailData.filter(
                  (p) => p.distanceKm >= startKm && p.distanceKm <= endKm,
                );
                if (segPoints.length < 2) return null;
                const segPath = segPoints
                  .map(
                    (p, i) =>
                      `${i === 0 ? "M" : "L"}${toX(p.distanceKm)},${toY(p.elevation)}`,
                  )
                  .join(" ");
                const segArea =
                  segPath +
                  ` L${toX(segPoints[segPoints.length - 1].distanceKm)},${top + plotH} L${toX(segPoints[0].distanceKm)},${top + plotH} Z`;
                return (
                  <g style={{ pointerEvents: "none" }}>
                    <path d={segArea} fill="var(--secondary)" opacity="0.15" />
                    <path
                      d={segPath}
                      fill="none"
                      stroke="var(--secondary)"
                      strokeWidth="2.5"
                      opacity="0.8"
                    />
                  </g>
                );
              })()}
            {/* Goal line */}
            {GOAL_KM <= maxDist && (
              <line
                x1={toX(GOAL_KM)}
                x2={toX(GOAL_KM)}
                y1={top}
                y2={top + plotH}
                stroke="var(--error)"
                strokeWidth="1.5"
                strokeDasharray="6,4"
                opacity="0.7"
              />
            )}
            {/* Hover crosshair */}
            {hovered && (
              <>
                <line
                  x1={toX(hovered.dist)}
                  x2={toX(hovered.dist)}
                  y1={top}
                  y2={top + plotH}
                  stroke="var(--secondary)"
                  strokeWidth="1"
                  strokeDasharray="4,3"
                  opacity="0.6"
                />
                <circle
                  cx={toX(hovered.dist)}
                  cy={toY(hovered.elevation)}
                  r="4"
                  fill="var(--secondary)"
                />
              </>
            )}
          </svg>
          {/* Segment endpoint markers (rendered as HTML on top of SVG) */}
          {segmentMarkers &&
            trailData &&
            (() => {
              const fromPt = trailData.reduce((best, p) =>
                Math.abs(p.distanceKm - segmentMarkers.fromDistKm) <
                Math.abs(best.distanceKm - segmentMarkers.fromDistKm)
                  ? p
                  : best,
              );
              const toPt = trailData.reduce((best, p) =>
                Math.abs(p.distanceKm - segmentMarkers.toDistKm) <
                Math.abs(best.distanceKm - segmentMarkers.toDistKm)
                  ? p
                  : best,
              );
              return (
                <>
                  <div style={{
                    position: 'absolute',
                    left: `calc(${(toX(toPt.distanceKm) / w) * 100}% - 6px)`,
                    top: `calc(${(toY(toPt.elevation) / h) * 100}% - 6px)`,
                    width: 12, height: 12,
                    borderRadius: '50%',
                    background: 'var(--secondary)',
                    border: '2px solid var(--surface)',
                    pointerEvents: 'none',
                  }} />
                  <img
                    src="/sasquatch.gif"
                    alt=""
                    style={{
                      position: 'absolute',
                      left: `calc(${(toX(fromPt.distanceKm) / w) * 100}% - 14px)`,
                      top: `calc(${(toY(fromPt.elevation) / h) * 100}% - 28px)`,
                      width: 28, height: 28,
                      imageRendering: 'pixelated',
                      pointerEvents: 'none',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                    }}
                  />
                </>
              );
            })()}
          {hovered && (
            <div
              className={styles.mapElevTooltip}
              style={{
                position: "fixed",
                left: hovered.x,
                top: hovered.y - 12,
                transform: "translate(-50%, -100%)",
              }}
            >
              {hovered.summitName && (
                <span style={{ color: "var(--secondary)" }}>
                  {hovered.summitName}
                </span>
              )}
              <strong>{Math.round(hovered.elevation)}m</strong>
              <span>{hovered.dist.toFixed(1)} km</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
