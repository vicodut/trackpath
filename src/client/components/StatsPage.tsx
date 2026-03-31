import { useEffect, useMemo, useState } from 'react';
import { TrackingPoint, StravaActivity } from '../types';
import { ICONIC_SUMMITS } from '../data/iconic-summits';

interface StatsPageProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  totalDistanceKm: number;
  totalElevationGain: number;
  isAdmin: boolean;
  onClose: () => void;
}

const AT_TOTAL_KM = 1500;
const BEER_CAL = 153; // regular beer 12 fl oz, ~5% alc
const BEER_CARBS = 12.6;
const BEER_PROTEIN = 1.6;
const BEER_ALCOHOL_G = 13.8;
const CAL_PER_KM = 90; // approx cal burned hiking with pack on AT
const ELEV_CHART_HEIGHT = 280;
const ELEV_CHART_PADDING = { top: 20, right: 16, bottom: 36, left: 50 };
const HIKE_START = '2026-04-15';
const HIKE_END = '2026-07-13';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildDailyKm(points: TrackingPoint[], stravaActivities: StravaActivity[]): Record<string, number> {
  const dailyKm: Record<string, number> = {};

  // Sort points by timestamp
  const sorted = [...points].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compute distance between consecutive points, assign to the day of the second point
  for (let i = 1; i < sorted.length; i++) {
    const dist = haversine(
      sorted[i - 1].latitude, sorted[i - 1].longitude,
      sorted[i].latitude, sorted[i].longitude,
    );
    // Skip unrealistic jumps (> 100km between two consecutive points)
    if (dist > 100) continue;
    const day = sorted[i].timestamp.slice(0, 10);
    dailyKm[day] = (dailyKm[day] || 0) + dist;
  }

  // Add Strava activity distances
  for (const act of stravaActivities) {
    if (!act.startDate || !act.distance) continue;
    const day = act.startDate.slice(0, 10);
    dailyKm[day] = (dailyKm[day] || 0) + act.distance / 1000;
  }

  return dailyKm;
}

// Monday=0 .. Sunday=6
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function getFixedWeeksGrid(dailyKm: Record<string, number>) {
  const start = new Date(HIKE_START + 'T00:00:00');
  const end = new Date(HIKE_END + 'T00:00:00');

  // Align start to Monday
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - mondayIndex(gridStart));

  // Align end to Sunday
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - mondayIndex(gridEnd)));

  const weeks: ({ date: string; km: number; row: number } | null)[][] = [];
  const months: { label: string; weekIndex: number }[] = [];
  let currentWeek: typeof weeks[0] = [];
  let lastMonth = -1;

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const row = mondayIndex(cursor); // 0=Mon, 6=Sun
    const inRange = cursor >= start && cursor <= end;

    currentWeek.push(inRange ? { date: dateStr, km: dailyKm[dateStr] || 0, row } : null);

    if (inRange && cursor.getMonth() !== lastMonth) {
      lastMonth = cursor.getMonth();
      months.push({
        label: cursor.toLocaleString('default', { month: 'short' }).toUpperCase(),
        weekIndex: weeks.length,
      });
    }

    // Sunday = end of week
    if (row === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return { weeks, months };
}

function intensityClass(km: number): string {
  if (km === 0) return 'heatmap-cell-0';
  if (km < 10) return 'heatmap-cell-1';
  if (km < 20) return 'heatmap-cell-2';
  if (km < 30) return 'heatmap-cell-3';
  return 'heatmap-cell-4';
}

function buildElevationProfile(points: TrackingPoint[]) {
  const sorted = [...points]
    .filter(p => p.altitude != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (sorted.length < 2) return [];

  let cumDist = 0;
  const profile: { dist: number; alt: number; date: string }[] = [
    { dist: 0, alt: sorted[0].altitude!, date: sorted[0].timestamp.slice(0, 10) },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const d = haversine(
      sorted[i - 1].latitude, sorted[i - 1].longitude,
      sorted[i].latitude, sorted[i].longitude,
    );
    if (d > 100) continue; // skip unrealistic jumps
    cumDist += d;
    profile.push({ dist: cumDist, alt: sorted[i].altitude!, date: sorted[i].timestamp.slice(0, 10) });
  }

  return profile;
}

function ElevationChart({ points }: { points: TrackingPoint[] }) {
  const profile = useMemo(() => buildElevationProfile(points), [points]);
  const [hovered, setHovered] = useState<{ alt: number; dist: number; x: number; y: number } | null>(null);

  if (profile.length < 2) return <div className="stats-empty">NO_ALTITUDE_DATA</div>;

  const maxDist = profile[profile.length - 1].dist;
  const alts = profile.map(p => p.alt);
  const minAlt = Math.min(...alts);
  const maxAlt = Math.max(...alts);
  const altRange = maxAlt - minAlt || 1;

  const w = 800;
  const h = ELEV_CHART_HEIGHT;
  const { top, right, bottom, left } = ELEV_CHART_PADDING;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const toX = (dist: number) => left + (dist / maxDist) * plotW;
  const toY = (alt: number) => top + plotH - ((alt - minAlt) / altRange) * plotH;

  // Build SVG path
  const pathD = profile.map((p, i) => {
    const x = toX(p.dist);
    const y = toY(p.alt);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  // Filled area
  const areaD = pathD + ` L${toX(maxDist)},${top + plotH} L${left},${top + plotH} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minAlt + (altRange * i) / (yTicks - 1))
  );

  // X-axis ticks
  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    Math.round((maxDist * i) / (xTicks - 1))
  );

  return (
    <div className="elev-chart-wrapper">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="elev-chart-svg"
        onMouseMove={(e) => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * w;
          const dist = ((mx - left) / plotW) * maxDist;
          // Find closest point
          let closest = profile[0];
          let minD = Infinity;
          for (const p of profile) {
            const d = Math.abs(p.dist - dist);
            if (d < minD) { minD = d; closest = p; }
          }
          setHovered({
            alt: closest.alt,
            dist: closest.dist,
            x: e.clientX,
            y: e.clientY,
          });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid lines */}
        {yTickValues.map(v => (
          <line key={`yg-${v}`} x1={left} x2={w - right} y1={toY(v)} y2={toY(v)} stroke="var(--outline-variant)" strokeWidth="0.5" opacity="0.3" />
        ))}
        {/* Filled area */}
        <path d={areaD} fill="url(#elevGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="2" />
        {/* Gradient def */}
        <defs>
          <linearGradient id="elevGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Y-axis labels */}
        {yTickValues.map(v => (
          <text key={`yl-${v}`} x={left - 6} y={toY(v) + 3} textAnchor="end" className="elev-chart-label">{v}m</text>
        ))}
        {/* X-axis labels */}
        {xTickValues.map(v => (
          <text key={`xl-${v}`} x={toX(v)} y={h - 6} textAnchor="middle" className="elev-chart-label">{v}km</text>
        ))}
        {/* Hover crosshair */}
        {hovered && (
          <>
            <line x1={toX(hovered.dist)} x2={toX(hovered.dist)} y1={top} y2={top + plotH} stroke="var(--secondary)" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
            <circle cx={toX(hovered.dist)} cy={toY(hovered.alt)} r="4" fill="var(--secondary)" />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className="heatmap-tooltip"
          style={{
            position: 'fixed',
            left: hovered.x,
            top: hovered.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <strong>{Math.round(hovered.alt)}m</strong>
          <span>{hovered.dist.toFixed(1)} km</span>
        </div>
      )}
    </div>
  );
}

interface TrailElevationPoint {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
}

const TRAIL_CHART_HEIGHT = 320;
const TRAIL_CHART_PADDING = { top: 24, right: 16, bottom: 56, left: 54 };

function TrailAltitudeProfile({ hikerDistanceKm, isAdmin }: { hikerDistanceKm: number; isAdmin: boolean }) {
  const [trailData, setTrailData] = useState<TrailElevationPoint[] | null>(null);
  const [hovered, setHovered] = useState<{ elevation: number; dist: number; x: number; y: number; summitName?: string } | null>(null);

  useEffect(() => {
    fetch('/at-trail-elevation.json')
      .then(res => res.json())
      .then(setTrailData)
      .catch(() => setTrailData(null));
  }, []);

  if (!trailData || trailData.length < 2) return null;

  const maxDist = trailData[trailData.length - 1].distanceKm;
  const elevations = trailData.map(p => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  const w = 800;
  const h = TRAIL_CHART_HEIGHT;
  const { top, right, bottom, left } = TRAIL_CHART_PADDING;
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

  // Hiker progress line
  const hikerX = toX(Math.min(hikerDistanceKm, maxDist));

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minElev + (elevRange * i) / (yTicks - 1))
  );

  // X-axis ticks
  const xTicks = 6;
  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    Math.round((maxDist * i) / (xTicks - 1))
  );

  // Notable peaks/landmarks on the AT
  const landmarks = [
    { name: 'Springer Mtn', distKm: 0 },
    { name: 'Katahdin', distKm: maxDist },
  ];

  return (
    <div className="elev-chart-wrapper">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="elev-chart-svg"
        onMouseMove={(e) => {
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
          // Check if near an iconic summit
          const nearSummit = ICONIC_SUMMITS.find(s => Math.abs(s.distanceKm - closest.distanceKm) < maxDist * 0.015);
          setHovered({
            elevation: closest.elevation,
            dist: closest.distanceKm,
            x: e.clientX,
            y: e.clientY,
            summitName: nearSummit?.name,
          });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid lines */}
        {yTickValues.map(v => (
          <line key={`yg-${v}`} x1={left} x2={w - right} y1={toY(v)} y2={toY(v)} stroke="var(--outline-variant)" strokeWidth="0.5" opacity="0.3" />
        ))}
        {/* Filled area — hiked portion */}
        <clipPath id="hikedClip">
          <rect x={left} y={0} width={hikerX - left} height={h} />
        </clipPath>
        <clipPath id="remainingClip">
          <rect x={hikerX} y={0} width={w - right - hikerX} height={h} />
        </clipPath>
        {/* Hiked area fill */}
        <path d={areaD} fill="url(#trailGradHiked)" clipPath="url(#hikedClip)" />
        {/* Remaining area fill */}
        <path d={areaD} fill="url(#trailGradRemaining)" clipPath="url(#remainingClip)" />
        {/* Hiked line */}
        <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="2" clipPath="url(#hikedClip)" />
        {/* Remaining line */}
        <path d={pathD} fill="none" stroke="var(--outline-variant)" strokeWidth="1.5" clipPath="url(#remainingClip)" />
        {/* Goal line */}
        {AT_TOTAL_KM <= maxDist && (
          <>
            <line x1={toX(AT_TOTAL_KM)} x2={toX(AT_TOTAL_KM)} y1={top} y2={top + plotH} stroke="var(--error)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7" />
            <text x={toX(AT_TOTAL_KM)} y={top - 4} textAnchor="middle" className="elev-chart-label" fill="var(--error)" style={{ fontSize: '11px', fontWeight: 'bold' }}>GOAL {AT_TOTAL_KM}km</text>
          </>
        )}
        {/* Hiker position marker */}
        {hikerDistanceKm > 0 && (
          <>
            <line x1={hikerX} x2={hikerX} y1={top} y2={top + plotH} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4,3" />
            <text x={hikerX} y={top - 4} textAnchor="middle" className="elev-chart-label" fill="var(--primary)" style={{ fontSize: '12px', fontWeight: 'bold' }}>{isAdmin ? 'YOU' : 'VICO'}</text>
          </>
        )}
        {/* Gradient defs */}
        <defs>
          <linearGradient id="trailGradHiked" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="trailGradRemaining" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--outline-variant)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--outline-variant)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Y-axis labels */}
        {yTickValues.map(v => (
          <text key={`yl-${v}`} x={left - 6} y={toY(v) + 3} textAnchor="end" className="elev-chart-label">{v}m</text>
        ))}
        {/* X-axis labels */}
        {xTickValues.map(v => (
          <text key={`xl-${v}`} x={toX(v)} y={top + plotH + 16} textAnchor="middle" className="elev-chart-label">{v}km</text>
        ))}
        {/* Landmark labels (below x-axis) */}
        {landmarks.map((lm, i) => (
          <text key={i} x={toX(lm.distKm)} y={top + plotH + 30} textAnchor={i === 0 ? 'start' : 'end'} className="elev-chart-label" style={{ fontSize: '10px' }}>{lm.name}</text>
        ))}
        {/* Iconic summit markers */}
        {ICONIC_SUMMITS.map(s => {
          if (s.distanceKm > maxDist) return null;
          const sx = toX(s.distanceKm);
          const sy = toY(s.elevation);
          const active = hovered?.summitName === s.name;
          return (
            <g key={s.name} style={{ pointerEvents: 'none' }}>
              <line x1={sx} x2={sx} y1={sy} y2={top + plotH} stroke={active ? 'var(--secondary)' : 'var(--on-surface-variant)'} strokeWidth="0.5" opacity={active ? 0.6 : 0.3} strokeDasharray="2,3" />
              <polygon points={`${sx},${sy - 8} ${sx - 4},${sy} ${sx + 4},${sy}`} fill={active ? 'var(--secondary)' : 'var(--on-surface-variant)'} opacity={active ? 1 : 0.6} />
            </g>
          );
        })}
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
          className="heatmap-tooltip"
          style={{
            position: 'fixed',
            left: hovered.x,
            top: hovered.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {hovered.summitName && <span style={{ color: 'var(--secondary)' }}>{hovered.summitName}</span>}
          <strong>{Math.round(hovered.elevation)}m</strong>
          <span>{hovered.dist.toFixed(1)} km</span>
        </div>
      )}
    </div>
  );
}

function BeerCalculator({ distanceKm }: { distanceKm: number }) {
  const calBurned = distanceKm * CAL_PER_KM;
  const beersEarned = Math.floor(calBurned / BEER_CAL);
  const totalCal = beersEarned * BEER_CAL;
  const totalCarbs = beersEarned * BEER_CARBS;
  const totalAlcohol = beersEarned * BEER_ALCOHOL_G;

  return (
    <div className="beer-calc">
      <div className="beer-calc-hero">
        <span className="beer-calc-beers">{beersEarned}</span>
        <span className="stats-label">BEERS_EARNED</span>
        <span className="beer-calc-emoji">
          {Array.from({ length: Math.min(beersEarned, 15) }).map((_, i) => (
            <span key={i}>🍺</span>
          ))}
          {beersEarned > 15 && <span>...</span>}
        </span>
      </div>
      <div className="beer-calc-stats">
        <div className="beer-calc-stat">
          <span className="stats-label">CAL_BURNED</span>
          <span className="beer-calc-value">{Math.round(calBurned)}<span className="beer-calc-unit">KCAL</span></span>
        </div>
        <div className="beer-calc-stat">
          <span className="stats-label">BEER_CAL</span>
          <span className="beer-calc-value">{totalCal}<span className="beer-calc-unit">KCAL</span></span>
        </div>
        <div className="beer-calc-stat">
          <span className="stats-label">CARBS</span>
          <span className="beer-calc-value">{totalCarbs.toFixed(0)}<span className="beer-calc-unit">G</span></span>
        </div>
        <div className="beer-calc-stat">
          <span className="stats-label">ALCOHOL</span>
          <span className="beer-calc-value">{totalAlcohol.toFixed(0)}<span className="beer-calc-unit">G</span></span>
        </div>
      </div>
      <div className="beer-calc-footnote">
        {distanceKm.toFixed(0)} km hiked × {CAL_PER_KM} cal/km = {Math.round(calBurned)} kcal ÷ {BEER_CAL} cal/beer
      </div>
    </div>
  );
}

export function StatsPage({ points, stravaActivities, totalDistanceKm, totalElevationGain, isAdmin, onClose }: StatsPageProps) {
  const [hoveredCell, setHoveredCell] = useState<{ date: string; km: number; x: number; y: number } | null>(null);

  const stats = useMemo(() => {
    const stravaDistanceKm = stravaActivities.reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0);
    const stravaElevation = stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0);

    const garminPoints = points.filter(p => !p.garminId?.startsWith('manual-'));

    let avgSpeed = 0;
    if (garminPoints.length >= 2) {
      const first = new Date(garminPoints[0].timestamp).getTime();
      const last = new Date(garminPoints[garminPoints.length - 1].timestamp).getTime();
      const hours = (last - first) / 3600000;
      if (hours > 0) avgSpeed = totalDistanceKm / hours;
    }

    const allDates = new Set<string>();
    garminPoints.forEach(p => allDates.add(new Date(p.timestamp).toDateString()));
    stravaActivities.forEach(a => {
      if (a.startDate) allDates.add(new Date(a.startDate).toDateString());
    });

    const combinedDist = totalDistanceKm + stravaDistanceKm;
    const combinedElev = totalElevationGain + stravaElevation;
    const progress = Math.min((combinedDist / AT_TOTAL_KM) * 100, 100);

    return {
      garminDist: totalDistanceKm,
      garminElev: totalElevationGain,
      stravaDist: stravaDistanceKm,
      stravaElev: stravaElevation,
      combinedDist,
      combinedElev,
      trackingPoints: points.length,
      stravaCount: stravaActivities.length,
      avgSpeed,
      daysOnTrail: allDates.size,
      progress,
    };
  }, [points, stravaActivities, totalDistanceKm, totalElevationGain]);

  const dailyKm = useMemo(() => buildDailyKm(points, stravaActivities), [points, stravaActivities]);
  const { weeks, months } = useMemo(() => getFixedWeeksGrid(dailyKm), [dailyKm]);
  const activeDays = Object.entries(dailyKm).filter(([date, km]) => {
    return km > 0 && date >= HIKE_START && date <= HIKE_END;
  }).length;

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const recentPoints = useMemo(() => {
    return [...points]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [points]);

  return (
    <div className="stats-page">
      <div className="stats-page-header">
        <h2>TRAIL_PERFORMANCE</h2>
        <button onClick={onClose}>CLOSE</button>
      </div>

      <div className="stats-page-content">
        {/* Progress section */}
        <section className="stats-section">
          <div className="stats-progress-header">
            <div>
              <span className="stats-label">TOTAL_DISTANCE</span>
              <div className="stats-hero-value">
                <span className="stats-hero-number">{stats.combinedDist.toFixed(0)}</span>
                <span className="stats-hero-unit">/ {AT_TOTAL_KM} KM</span>
              </div>
            </div>
            <div className="stats-progress-pct">
              <span className="stats-label">THRU_AT</span>
              <span className="stats-big-value">{stats.progress.toFixed(1)}%</span>
            </div>
          </div>
          <div className="stats-progress-bars">
            <div className="stats-progress-bar stats-progress-bar--full">
              <div className="stats-progress-fill stats-progress-fill--full" style={{ width: `${(stats.combinedDist / 3500) * 100}%` }} />
              <span className="stats-progress-label">FULL AT — 3,500 KM ({((stats.combinedDist / 3500) * 100).toFixed(1)}%)</span>
            </div>
            <div className="stats-progress-bar">
              <div className="stats-progress-fill" style={{ width: `${stats.progress}%` }} />
              <span className="stats-progress-label">GOAL — {AT_TOTAL_KM} KM</span>
            </div>
          </div>
        </section>

        {/* Bento grid */}
        <section className="stats-bento">
          <div className="stats-bento-card stats-bento-accent">
            <span className="stats-label">DAYS_ON_TRAIL</span>
            <span className="stats-bento-number">{stats.daysOnTrail}</span>
          </div>
          <div className="stats-bento-card">
            <span className="stats-label">TOTAL_ASCENT</span>
            <div className="stats-bento-number">{Math.round(stats.combinedElev)}<span className="stats-bento-unit">M</span></div>
          </div>
          <div className="stats-bento-card">
            <span className="stats-label">TRACKING_PTS</span>
            <span className="stats-bento-number">{stats.trackingPoints}</span>
          </div>
          <div className="stats-bento-card">
            <span className="stats-label">STRAVA_ACTIVITIES</span>
            <span className="stats-bento-number">{stats.stravaCount}</span>
          </div>
          {stats.avgSpeed > 0 && (
            <div className="stats-bento-card">
              <span className="stats-label">AVG_SPEED</span>
              <div className="stats-bento-number">{stats.avgSpeed.toFixed(1)}<span className="stats-bento-unit">KM/H</span></div>
            </div>
          )}
          <div className="stats-bento-card">
            <span className="stats-label">GARMIN_DIST</span>
            <div className="stats-bento-number">{stats.garminDist.toFixed(1)}<span className="stats-bento-unit">KM</span></div>
          </div>
          <div className="stats-bento-card">
            <span className="stats-label">STRAVA_DIST</span>
            <div className="stats-bento-number">{stats.stravaDist.toFixed(1)}<span className="stats-bento-unit">KM</span></div>
          </div>
        </section>

        {/* Activity heatmap */}
        <section className="stats-section">
          <div className="stats-heatmap-header">
            <h3>ACTIVITY_LOG</h3>
            <span className="stats-label">{activeDays} / 90 ACTIVE_DAYS</span>
          </div>
          <div className="heatmap-wrapper" style={{ position: 'relative' }}>
            {/* Month labels */}
            <div className="heatmap-months-row" style={{ position: 'relative', height: 16, marginLeft: 20, marginBottom: 2 }}>
              {months.map((m, i) => (
                <span
                  key={i}
                  className="heatmap-month-label"
                  style={{ position: 'absolute', left: m.weekIndex * 13 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            {/* Grid with day labels */}
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Day of week labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {DAY_LABELS.map((label, i) => (
                  <span key={i} className="heatmap-day-label">{i % 2 === 0 ? label : ''}</span>
                ))}
              </div>
              {/* The grid — iterate column-first (week by week) */}
              <div className="heatmap-grid">
                {weeks.map((week, col) => (
                  Array.from({ length: 7 }).map((_, row) => {
                    const cell = week[row];
                    if (!cell) return <div key={`${col}-${row}`} className="heatmap-cell heatmap-cell-empty" />;
                    return (
                      <div
                        key={`${col}-${row}`}
                        className={`heatmap-cell ${intensityClass(cell.km)}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            date: cell.date,
                            km: cell.km,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        onTouchStart={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            date: cell.date,
                            km: cell.km,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onTouchEnd={() => setHoveredCell(null)}
                      />
                    );
                  })
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="heatmap-legend">
              <span className="stats-label">0 KM</span>
              <div className="heatmap-cell heatmap-cell-0" />
              <div className="heatmap-cell heatmap-cell-1" />
              <div className="heatmap-cell heatmap-cell-2" />
              <div className="heatmap-cell heatmap-cell-3" />
              <div className="heatmap-cell heatmap-cell-4" />
              <span className="stats-label">30+ KM</span>
            </div>
            {/* Tooltip */}
            {hoveredCell && (
              <div
                className="heatmap-tooltip"
                style={{
                  position: 'fixed',
                  left: hoveredCell.x,
                  top: hoveredCell.y - 8,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <strong>{hoveredCell.km.toFixed(1)} km</strong>
                <span>{hoveredCell.date}</span>
              </div>
            )}
          </div>
        </section>

        {/* AT Trail altitude profile */}
        <section className="stats-section">
          <h3 className="stats-section-title">AT_TRAIL_PROFILE</h3>
          <TrailAltitudeProfile hikerDistanceKm={stats.combinedDist} isAdmin={isAdmin} />
        </section>

        {/* Elevation profile from tracking */}
        <section className="stats-section">
          <h3 className="stats-section-title">ELEVATION_PROFILE</h3>
          <ElevationChart points={points} />
        </section>

        {/* Beer calculator */}
        <section className="stats-section">
          <h3 className="stats-section-title">BEER_CALCULATOR</h3>
          <BeerCalculator distanceKm={stats.combinedDist} />
        </section>

        {/* Recent events */}
        <section className="stats-section">
          <h3 className="stats-section-title">RECENT_EVENTS</h3>
          <div className="stats-events">
            {recentPoints.map((pt) => {
              const time = new Date(pt.timestamp);
              return (
                <div key={pt.id} className="stats-event">
                  <div className="stats-event-info">
                    <span className="stats-event-type">
                      {pt.eventType || 'TRACKING'}
                    </span>
                    <span className="stats-event-coords">
                      {pt.latitude.toFixed(4)}, {pt.longitude.toFixed(4)}
                    </span>
                    {pt.message && <span className="stats-event-msg">{pt.message}</span>}
                  </div>
                  <span className="stats-event-time">
                    {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
