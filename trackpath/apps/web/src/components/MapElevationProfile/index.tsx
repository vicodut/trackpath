import { useEffect, useState, useCallback, useRef } from "react";
import { ICONIC_SUMMITS } from "../../data/iconic-summits";
import { useUnit } from "../../hooks/useUnit";
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
  campMarkers?: number[];
  currentDistKm?: number | null;
}

const CHART_HEIGHT_DESKTOP = 160;
const CHART_HEIGHT_MOBILE = 110;
const CHART_PADDING = { top: 14, right: 14, bottom: 26, left: 48 };
const GOAL_KM = 1500;
const MIN_ZOOM_RANGE_KM = 20;

function findClosestByDistance(
  data: TrailElevationPoint[],
  targetDist: number,
): TrailElevationPoint {
  let lo = 0;
  let hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (data[mid].distanceKm < targetDist) lo = mid + 1;
    else hi = mid;
  }
  if (
    lo > 0 &&
    Math.abs(data[lo - 1].distanceKm - targetDist) <=
      Math.abs(data[lo].distanceKm - targetDist)
  ) {
    return data[lo - 1];
  }
  return data[lo];
}

export function MapElevationProfile({
  onHover,
  onHoverEnd,
  segmentMarkers,
  campMarkers,
  currentDistKm,
}: MapElevationProfileProps) {
  const { fmtDist } = useUnit();
  const [trailData, setTrailData] = useState<TrailElevationPoint[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<{
    elevation: number;
    dist: number;
    x: number;
    y: number;
    isTouch?: boolean;
    summitName?: string;
  } | null>(null);
  const [svgWidth, setSvgWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(() =>
    window.innerWidth <= 768 ? CHART_HEIGHT_MOBILE : CHART_HEIGHT_DESKTOP,
  );
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const cachedRectRef = useRef<DOMRect | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<{ clientX: number; clientY: number; isTouch: boolean } | null>(null);
  const lastOnHoverRef = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);

  // Refs for zoom state — used inside native event listeners to avoid stale closures
  const trailDataRef = useRef<TrailElevationPoint[] | null>(null);
  const viewStartRef = useRef(0);
  const viewEndRef = useRef<number | null>(null);
  const svgWidthRef = useRef(800);
  const userHasZoomed = useRef(false);
  const dragRef = useRef<{ startX: number; startViewStart: number; startViewEnd: number } | null>(null);
  const pinchRef = useRef<{ dist: number; midKm: number; start: number; end: number } | null>(null);

  // Keep refs in sync on every render
  trailDataRef.current = trailData;
  viewStartRef.current = viewStart;
  viewEndRef.current = viewEnd;
  svgWidthRef.current = svgWidth;

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
        cachedRectRef.current = (entry.target as HTMLElement).getBoundingClientRect();
        const targetHeight = newWidth <= 768 ? CHART_HEIGHT_MOBILE : CHART_HEIGHT_DESKTOP;
        setChartHeight(prev => prev === targetHeight ? prev : targetHeight);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [collapsed, trailData]);

  const processHover = useCallback(
    (clientX: number, clientY: number, isTouch = false) => {
      if (!trailData || trailData.length < 2 || !containerRef.current) return;

      const fullRange = trailData[trailData.length - 1].distanceKm;
      const effectiveEnd = viewEnd ?? fullRange;
      const vr = effectiveEnd - viewStart || 1;
      const { left } = CHART_PADDING;
      const plotW = svgWidth - left - CHART_PADDING.right;

      const rect = cachedRectRef.current ?? containerRef.current.getBoundingClientRect();
      const scale = rect.width > 0 ? svgWidth / rect.width : 1;
      const mx = (clientX - rect.left) * scale;
      const dist = viewStart + ((mx - left) / plotW) * vr;

      const closest = findClosestByDistance(trailData, Math.max(0, Math.min(fullRange, dist)));

      const proximity = Math.min(vr * 0.03, 5);
      const nearSummit = ICONIC_SUMMITS.find(
        (s) => Math.abs(s.distanceKm - closest.distanceKm) < proximity,
      );
      setHovered({
        elevation: closest.elevation,
        dist: closest.distanceKm,
        x: clientX,
        y: clientY,
        isTouch,
        summitName: nearSummit?.name,
      });

      const now = performance.now();
      if (now - lastOnHoverRef.current >= 32) {
        lastOnHoverRef.current = now;
        onHover?.(closest.lat, closest.lon);
      }
    },
    [trailData, onHover, svgWidth, viewStart, viewEnd],
  );

  const updateHover = useCallback(
    (clientX: number, clientY: number, isTouch = false) => {
      pendingHoverRef.current = { clientX, clientY, isTouch };
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const p = pendingHoverRef.current;
        if (p) {
          pendingHoverRef.current = null;
          processHover(p.clientX, p.clientY, p.isTouch);
        }
      });
    },
    [processHover],
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const clearHover = useCallback(() => {
    setHovered(null);
    onHoverEnd();
  }, [onHoverEnd]);

  // All touch + wheel interactions in one effect (uses refs for view state)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || collapsed) return;

    const getPinchDist = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const clampView = (start: number, end: number, fullRange: number) => {
      const range = end - start;
      let s = start;
      let e = end;
      if (s < 0) { s = 0; e = Math.min(fullRange, range); }
      if (e > fullRange) { e = fullRange; s = Math.max(0, fullRange - range); }
      return { s, e };
    };

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length === 1) {
        ev.preventDefault();
        updateHover(ev.touches[0].clientX, ev.touches[0].clientY, true);
      } else if (ev.touches.length === 2 && trailDataRef.current) {
        const td = trailDataRef.current;
        const fullRange = td[td.length - 1].distanceKm;
        const vs = viewStartRef.current;
        const ve = viewEndRef.current ?? fullRange;
        const vr = ve - vs || 1;
        const sw = svgWidthRef.current;
        const { left } = CHART_PADDING;
        const plotW = sw - left - CHART_PADDING.right;
        const rect = cachedRectRef.current ?? el.getBoundingClientRect();
        const scale = rect.width > 0 ? sw / rect.width : 1;
        const midClientX = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
        const mx = (midClientX - rect.left) * scale;
        const midKm = vs + ((mx - left) / plotW) * vr;
        pinchRef.current = { dist: getPinchDist(ev.touches), midKm, start: vs, end: ve };
        userHasZoomed.current = true;
      }
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length === 1 && !pinchRef.current) {
        ev.preventDefault();
        updateHover(ev.touches[0].clientX, ev.touches[0].clientY, true);
      } else if (ev.touches.length === 2 && pinchRef.current && trailDataRef.current) {
        ev.preventDefault();
        const td = trailDataRef.current;
        const fullRange = td[td.length - 1].distanceKm;
        const newDist = getPinchDist(ev.touches);
        const factor = pinchRef.current.dist / newDist; // <1 = zoom in
        const pinchRange = pinchRef.current.end - pinchRef.current.start;
        const newRange = Math.max(MIN_ZOOM_RANGE_KM, pinchRange * factor);
        const ratio = Math.max(0, Math.min(1, (pinchRef.current.midKm - pinchRef.current.start) / pinchRange));
        const { s, e } = clampView(
          pinchRef.current.midKm - ratio * newRange,
          pinchRef.current.midKm + (1 - ratio) * newRange,
          fullRange,
        );
        setViewStart(s);
        setViewEnd(e);
      }
    };

    const onTouchEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) pinchRef.current = null;
      if (ev.touches.length === 0) clearHover();
    };

    const onWheel = (ev: WheelEvent) => {
      const td = trailDataRef.current;
      if (!td || td.length < 2) return;
      ev.preventDefault();
      userHasZoomed.current = true;

      const fullRange = td[td.length - 1].distanceKm;
      const vs = viewStartRef.current;
      const ve = viewEndRef.current ?? fullRange;
      const vr = ve - vs || 1;
      const sw = svgWidthRef.current;
      const { left } = CHART_PADDING;
      const plotW = sw - left - CHART_PADDING.right;
      const rect = cachedRectRef.current ?? el.getBoundingClientRect();
      const scale = rect.width > 0 ? sw / rect.width : 1;
      const mx = (ev.clientX - rect.left) * scale;
      const cursorKm = vs + ((mx - left) / plotW) * vr;

      const factor = ev.deltaY < 0 ? 0.75 : 1.33;
      const newRange = Math.max(MIN_ZOOM_RANGE_KM, vr * factor);
      const ratio = Math.max(0, Math.min(1, (cursorKm - vs) / vr));
      const { s, e } = clampView(
        cursorKm - ratio * newRange,
        cursorKm + (1 - ratio) * newRange,
        fullRange,
      );
      setViewStart(s);
      setViewEnd(e);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [collapsed, updateHover, clearHover]);

  if (!trailData || trailData.length < 2) return null;

  const fullRange = trailData[trailData.length - 1].distanceKm;
  const effectiveViewEnd = viewEnd ?? fullRange;
  const visibleRange = Math.max(effectiveViewEnd - viewStart, 1);
  const zoomLevel = fullRange / visibleRange;

  const w = svgWidth;
  const h = chartHeight;
  const { top, right, bottom, left } = CHART_PADDING;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  // Filter to visible data with a small buffer for smooth edges
  const buf = visibleRange * 0.05;
  const visibleData = trailData.filter(
    p => p.distanceKm >= viewStart - buf && p.distanceKm <= effectiveViewEnd + buf,
  );
  const dataForElev = visibleData.length > 1 ? visibleData : trailData;
  const elevations = dataForElev.map((p) => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  const toX = (dist: number) => left + ((dist - viewStart) / visibleRange) * plotW;
  const toY = (elev: number) => top + plotH - ((elev - minElev) / elevRange) * plotH;

  const pathD = visibleData
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.distanceKm).toFixed(1)},${toY(p.elevation).toFixed(1)}`)
    .join(" ");

  const firstX = visibleData.length > 0 ? toX(visibleData[0].distanceKm) : left;
  const lastX = visibleData.length > 0 ? toX(visibleData[visibleData.length - 1].distanceKm) : left + plotW;
  const areaD = pathD + ` L${lastX},${top + plotH} L${firstX},${top + plotH} Z`;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minElev + (elevRange * i) / (yTicks - 1)),
  );

  const tickStep =
    visibleRange < 50 ? 5 :
    visibleRange < 100 ? 10 :
    visibleRange < 300 ? 25 : 100;
  const xTickValues: number[] = [];
  for (let km = Math.ceil(viewStart / tickStep) * tickStep; km <= effectiveViewEnd + 0.01; km += tickStep) {
    xTickValues.push(km);
  }

  // Drag-to-pan handlers (defined at render time — always capture current derived values)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startViewStart: viewStart, startViewEnd: effectiveViewEnd };
    setIsDragging(true);
    setHovered(null);
    userHasZoomed.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const { startX, startViewStart, startViewEnd } = dragRef.current;
      const vr = startViewEnd - startViewStart;
      const rect = cachedRectRef.current ?? containerRef.current!.getBoundingClientRect();
      const scale = rect.width > 0 ? svgWidth / rect.width : 1;
      const dxKm = -((e.clientX - startX) * scale / plotW) * vr;
      const s = Math.max(0, startViewStart + dxKm);
      const e2 = s + vr;
      setViewStart(s);
      setViewEnd(Math.min(fullRange, e2));
    } else {
      updateHover(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    dragRef.current = null;
    setIsDragging(false);
    clearHover();
  };

  const resetZoom = () => {
    setViewStart(0);
    setViewEnd(null);
    userHasZoomed.current = false;
  };

  // Visible range filter helpers
  const inView = (km: number) => km >= viewStart && km <= effectiveViewEnd;

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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{ touchAction: "none", cursor: isDragging ? "grabbing" : "grab" }}
        >
          {zoomLevel > 1.05 && (
            <button className={styles.zoomReset} onClick={(e) => { e.stopPropagation(); resetZoom(); }}>
              ×{zoomLevel.toFixed(1)} reset
            </button>
          )}
          <svg
            ref={svgRef}
            style={{ width: "100%", height: h, pointerEvents: "none" }}
            viewBox={`0 0 ${w} ${h}`}
            className={styles.mapElevSvg}
          >
            <defs>
              <linearGradient id="mapElevGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.02" />
              </linearGradient>
              <clipPath id="elevChartClip">
                <rect x={left} y={top - 10} width={plotW} height={plotH + 10} />
              </clipPath>
            </defs>

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

            {/* Chart content clipped to plot area */}
            <g clipPath="url(#elevChartClip)">
              {/* Filled area */}
              <path d={areaD} fill="url(#mapElevGrad)" />
              {/* Line */}
              <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="1.5" />

              {/* Iconic summit markers */}
              {ICONIC_SUMMITS.map((s) => {
                if (!inView(s.distanceKm) || s.distanceKm > fullRange) return null;
                const sx = toX(s.distanceKm);
                const sy = toY(s.elevation);
                const active = hovered?.summitName === s.name;
                return (
                  <g key={s.name} style={{ pointerEvents: "none" }}>
                    <line
                      x1={sx} x2={sx} y1={sy} y2={top + plotH}
                      stroke={active ? "var(--secondary)" : "var(--on-surface-variant)"}
                      strokeWidth="0.5"
                      opacity={active ? 0.6 : 0.25}
                      strokeDasharray="2,3"
                    />
                    <polygon
                      points={`${sx},${sy - 6} ${sx - 3},${sy} ${sx + 3},${sy}`}
                      fill={active ? "var(--secondary)" : "var(--on-surface-variant)"}
                      opacity={active ? 1 : 0.5}
                    />
                  </g>
                );
              })}

              {/* Selected segment highlight */}
              {segmentMarkers && (() => {
                const startKm = Math.min(segmentMarkers.fromDistKm, segmentMarkers.toDistKm);
                const endKm = Math.max(segmentMarkers.fromDistKm, segmentMarkers.toDistKm);
                const segPoints = trailData.filter(
                  (p) => p.distanceKm >= startKm && p.distanceKm <= endKm,
                );
                if (segPoints.length < 2) return null;
                const segPath = segPoints
                  .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.distanceKm)},${toY(p.elevation)}`)
                  .join(" ");
                const segArea =
                  segPath +
                  ` L${toX(segPoints[segPoints.length - 1].distanceKm)},${top + plotH} L${toX(segPoints[0].distanceKm)},${top + plotH} Z`;
                return (
                  <g style={{ pointerEvents: "none" }}>
                    <path d={segArea} fill="var(--secondary)" opacity="0.15" />
                    <path d={segPath} fill="none" stroke="var(--secondary)" strokeWidth="2.5" opacity="0.8" />
                  </g>
                );
              })()}

              {/* Goal line */}
              {GOAL_KM <= fullRange && inView(GOAL_KM) && (
                <line
                  x1={toX(GOAL_KM)} x2={toX(GOAL_KM)}
                  y1={top} y2={top + plotH}
                  stroke="var(--error)"
                  strokeWidth="1.5"
                  strokeDasharray="6,4"
                  opacity="0.7"
                />
              )}

              {/* Camp markers */}
              {campMarkers && campMarkers.map((distKm) => {
                if (!inView(distKm)) return null;
                const x = toX(distKm);
                const y = top + plotH;
                return (
                  <polygon
                    key={`camp-${distKm}`}
                    points={`${x},${y - 7} ${x - 4},${y} ${x + 4},${y}`}
                    fill="var(--secondary)"
                    opacity="0.45"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              })}

              {/* Current position sasquatch */}
              {currentDistKm != null && inView(currentDistKm) && (() => {
                const pt = findClosestByDistance(trailData, currentDistKm);
                const cx = toX(pt.distanceKm);
                const cy = toY(pt.elevation);
                const size = 32;
                return (
                  <foreignObject x={cx - size / 2} y={cy - size} width={size} height={size} style={{ pointerEvents: 'none' }}>
                    <img
                      src="/sasquatch.gif"
                      alt=""
                      style={{ width: size, height: size, imageRendering: 'pixelated', filter: 'drop-shadow(0 0 4px rgba(254,107,0,0.7))' }}
                    />
                  </foreignObject>
                );
              })()}

              {/* Hover crosshair */}
              {hovered && !isDragging && (
                <>
                  <line
                    x1={toX(hovered.dist)} x2={toX(hovered.dist)}
                    y1={top} y2={top + plotH}
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

              {/* Segment endpoint markers */}
              {segmentMarkers && (() => {
                const startKm = Math.min(segmentMarkers.fromDistKm, segmentMarkers.toDistKm);
                const endKm = Math.max(segmentMarkers.fromDistKm, segmentMarkers.toDistKm);
                const segPts = trailData.filter(
                  (p) => p.distanceKm >= startKm && p.distanceKm <= endKm,
                );
                if (segPts.length < 2) return null;
                const leftPt = segPts[0];
                const rightPt = segPts[segPts.length - 1];
                const fromPt = segmentMarkers.fromDistKm <= segmentMarkers.toDistKm ? leftPt : rightPt;
                const toPt = segmentMarkers.fromDistKm <= segmentMarkers.toDistKm ? rightPt : leftPt;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    {inView(toPt.distanceKm) && (
                      <circle cx={toX(toPt.distanceKm)} cy={toY(toPt.elevation)} r={5} fill="var(--secondary)" stroke="var(--surface)" strokeWidth={2} />
                    )}
                    {inView(fromPt.distanceKm) && (
                      <foreignObject x={toX(fromPt.distanceKm) - 14} y={toY(fromPt.elevation) - 28} width={28} height={28}>
                        <img
                          src="/sasquatch.gif"
                          alt=""
                          style={{ width: 28, height: 28, imageRendering: 'pixelated', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                        />
                      </foreignObject>
                    )}
                  </g>
                );
              })()}
            </g>

            {/* Y-axis labels (outside clip) */}
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

            {/* X-axis labels (outside clip) */}
            {xTickValues.map((v) => (
              <text
                key={`xl-${v}`}
                x={toX(v)}
                y={h - 4}
                textAnchor="middle"
                className={styles.mapElevLabel}
              >
                {fmtDist(v, 0)}
              </text>
            ))}
          </svg>

          {hovered && !isDragging && (
            <div
              className={styles.mapElevTooltip}
              style={{
                position: "fixed",
                left: hovered.x,
                top: hovered.y - (hovered.isTouch ? 60 : 12),
                transform: "translate(-50%, -100%)",
              }}
            >
              {hovered.summitName && (
                <span style={{ color: "var(--secondary)" }}>{hovered.summitName}</span>
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
