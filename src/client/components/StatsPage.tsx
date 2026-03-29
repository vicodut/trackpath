import { useMemo, useState } from 'react';
import { TrackingPoint, StravaActivity } from '../types';

interface StatsPageProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  totalDistanceKm: number;
  totalElevationGain: number;
  onClose: () => void;
}

const AT_TOTAL_KM = 1300;
const ELEV_CHART_HEIGHT = 200;
const ELEV_CHART_PADDING = { top: 20, right: 16, bottom: 30, left: 46 };
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

export function StatsPage({ points, stravaActivities, totalDistanceKm, totalElevationGain, onClose }: StatsPageProps) {
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
              <span className="stats-label">THRU_PCT</span>
              <span className="stats-big-value">{stats.progress.toFixed(1)}%</span>
            </div>
          </div>
          <div className="stats-progress-bar">
            <div className="stats-progress-fill" style={{ width: `${stats.progress}%` }} />
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

        {/* Elevation profile */}
        <section className="stats-section">
          <h3 className="stats-section-title">ELEVATION_PROFILE</h3>
          <ElevationChart points={points} />
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
