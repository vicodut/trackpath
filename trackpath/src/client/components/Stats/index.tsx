import { useState, useMemo } from 'react';
import type { TrackingPoint, StravaActivity } from '../../types';
import styles from './Stats.module.css';

interface StatsProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  totalDistanceKm: number;
  totalElevationGain: number;
}

export function Stats({ points, stravaActivities, totalDistanceKm, totalElevationGain }: StatsProps) {
  const [open, setOpen] = useState(false);

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

    const timestamps = garminPoints.map(p => new Date(p.timestamp).toDateString());
    const uniqueDays = new Set(timestamps).size;

    return {
      garminDist: totalDistanceKm,
      garminElev: totalElevationGain,
      stravaDist: stravaDistanceKm,
      stravaElev: stravaElevation,
      trackingPoints: points.length,
      stravaCount: stravaActivities.length,
      avgSpeed,
      daysOnTrail: uniqueDays,
    };
  }, [points, stravaActivities, totalDistanceKm, totalElevationGain]);

  return (
    <div className={styles.statsWidget} onClick={() => setOpen(!open)}>
      <div className={styles.statsWidgetHeader}>
        <span className={styles.statsWidgetTitle}>Stats</span>
        <span className={styles.statsWidgetToggle}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.statsWidgetBody}>
          <div className={styles.statsWidgetSection}>Garmin</div>
          <div className={styles.statsWidgetRow}>
            <span>Distance</span>
            <strong>{stats.garminDist.toFixed(1)} km</strong>
          </div>
          <div className={styles.statsWidgetRow}>
            <span>Elevation</span>
            <strong>{Math.round(stats.garminElev)} m</strong>
          </div>
          <div className={styles.statsWidgetRow}>
            <span>Points</span>
            <strong>{stats.trackingPoints}</strong>
          </div>

          <div className={styles.statsWidgetSection}>Strava</div>
          <div className={styles.statsWidgetRow}>
            <span>Distance</span>
            <strong>{stats.stravaDist.toFixed(1)} km</strong>
          </div>
          <div className={styles.statsWidgetRow}>
            <span>Elevation</span>
            <strong>{Math.round(stats.stravaElev)} m</strong>
          </div>
          <div className={styles.statsWidgetRow}>
            <span>Activities</span>
            <strong>{stats.stravaCount}</strong>
          </div>

          <div className={styles.statsWidgetSection}>Overall</div>
          {stats.avgSpeed > 0 && (
            <div className={styles.statsWidgetRow}>
              <span>Avg speed</span>
              <strong>{stats.avgSpeed.toFixed(1)} km/h</strong>
            </div>
          )}
          <div className={styles.statsWidgetRow}>
            <span>Days on trail</span>
            <strong>{stats.daysOnTrail}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
