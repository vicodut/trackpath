import { useMemo } from 'react';
import { TrackingPoint, StravaActivity } from '../types';

interface StatsPageProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  totalDistanceKm: number;
  totalElevationGain: number;
  onClose: () => void;
}

const AT_TOTAL_KM = 3500;

function buildHeatmapData(points: TrackingPoint[], stravaActivities: StravaActivity[]) {
  const counts: Record<string, number> = {};

  for (const pt of points) {
    const day = pt.timestamp.slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  }

  for (const act of stravaActivities) {
    if (!act.startDate) continue;
    const day = act.startDate.slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  }

  return counts;
}

function getWeeksGrid(counts: Record<string, number>) {
  const allDates = Object.keys(counts).sort();
  if (allDates.length === 0) return { weeks: [], months: [] };

  const start = new Date(allDates[0] + 'T00:00:00');
  const end = new Date(allDates[allDates.length - 1] + 'T00:00:00');

  // Align start to Sunday
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // Align end to Saturday
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: { date: string; count: number; dayOfWeek: number }[][] = [];
  const months: { label: string; weekIndex: number }[] = [];
  let currentWeek: { date: string; count: number; dayOfWeek: number }[] = [];
  let lastMonth = -1;

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getDay();
    currentWeek.push({ date: dateStr, count: counts[dateStr] || 0, dayOfWeek });

    if (cursor.getMonth() !== lastMonth) {
      lastMonth = cursor.getMonth();
      months.push({
        label: cursor.toLocaleString('default', { month: 'short' }).toUpperCase(),
        weekIndex: weeks.length,
      });
    }

    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return { weeks, months };
}

function intensityClass(count: number): string {
  if (count === 0) return 'heatmap-cell-0';
  if (count <= 2) return 'heatmap-cell-1';
  if (count <= 5) return 'heatmap-cell-2';
  if (count <= 10) return 'heatmap-cell-3';
  return 'heatmap-cell-4';
}

export function StatsPage({ points, stravaActivities, totalDistanceKm, totalElevationGain, onClose }: StatsPageProps) {
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

  const heatmapCounts = useMemo(() => buildHeatmapData(points, stravaActivities), [points, stravaActivities]);
  const { weeks, months } = useMemo(() => getWeeksGrid(heatmapCounts), [heatmapCounts]);
  const totalActiveDays = Object.values(heatmapCounts).filter(c => c > 0).length;

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
            <span className="stats-label">{totalActiveDays} ACTIVE_DAYS</span>
          </div>
          {weeks.length > 0 ? (
            <div className="heatmap-wrapper">
              <div className="heatmap-months">
                {months.map((m, i) => (
                  <span
                    key={i}
                    className="heatmap-month-label"
                    style={{ gridColumnStart: m.weekIndex + 1 }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
              <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
                {Array.from({ length: 7 }).map((_, row) => (
                  weeks.map((week, col) => {
                    const cell = week.find(d => d.dayOfWeek === row);
                    return (
                      <div
                        key={`${col}-${row}`}
                        className={`heatmap-cell ${cell ? intensityClass(cell.count) : 'heatmap-cell-empty'}`}
                        title={cell ? `${cell.date}: ${cell.count} events` : ''}
                      />
                    );
                  })
                ))}
              </div>
              <div className="heatmap-legend">
                <span className="stats-label">LESS</span>
                <div className="heatmap-cell heatmap-cell-0" />
                <div className="heatmap-cell heatmap-cell-1" />
                <div className="heatmap-cell heatmap-cell-2" />
                <div className="heatmap-cell heatmap-cell-3" />
                <div className="heatmap-cell heatmap-cell-4" />
                <span className="stats-label">MORE</span>
              </div>
            </div>
          ) : (
            <div className="stats-empty">NO_DATA_AVAILABLE</div>
          )}
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
