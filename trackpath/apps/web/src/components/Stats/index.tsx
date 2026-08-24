import { useState, useMemo } from 'react';
import type { TrackingPoint, StravaActivity } from '../../types';
import { haversine } from '../../lib/geo';
import { useUnit } from '../../hooks/useUnit';
import styles from './Stats.module.css';

const KATAHDIN_KM = 3119;

interface StatsProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  totalDistanceKm: number;
  totalElevationGain: number;
}

export function Stats({ points, stravaActivities, totalDistanceKm, totalElevationGain }: StatsProps) {
  const [open, setOpen] = useState(false);
  const { fmtDist } = useUnit();

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

    // Rolling 7-day pace
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recentPts = garminPoints.filter(p => new Date(p.timestamp).getTime() >= sevenDaysAgo);
    let pace7day = 0;
    if (recentPts.length >= 2) {
      let dist7 = 0;
      for (let i = 1; i < recentPts.length; i++) {
        const d = haversine(recentPts[i-1].latitude, recentPts[i-1].longitude, recentPts[i].latitude, recentPts[i].longitude);
        if (d < 100) dist7 += d;
      }
      pace7day = dist7 / 7;
    }

    const remainingKm = Math.max(0, KATAHDIN_KM - totalDistanceKm);
    let etaDate: Date | null = null;
    if (pace7day > 0 && remainingKm > 0) {
      const etaDays = remainingKm / pace7day;
      etaDate = new Date(Date.now() + etaDays * 86400000);
    }

    return {
      garminDist: totalDistanceKm,
      garminElev: totalElevationGain,
      stravaDist: stravaDistanceKm,
      stravaElev: stravaElevation,
      trackingPoints: points.length,
      stravaCount: stravaActivities.length,
      avgSpeed,
      daysOnTrail: uniqueDays,
      pace7day,
      remainingKm,
      etaDate,
    };
  }, [points, stravaActivities, totalDistanceKm, totalElevationGain]);

  return (
    <div className={styles.statsWidget} onClick={() => { setOpen(!open); }}>
      <div className={styles.statsWidgetHeader}>
        <span className={styles.statsWidgetTitle}>Stats</span>
        <span className={styles.statsWidgetToggle}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className={styles.statsWidgetBody}>
          <div className={styles.statsWidgetSection}>Garmin</div>
          <div className={styles.statsWidgetRow}>
            <span>Distance</span>
            <strong>{fmtDist(stats.garminDist)}</strong>
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
            <strong>{fmtDist(stats.stravaDist)}</strong>
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

          {stats.remainingKm > 0 && (
            <>
              <div className={styles.statsWidgetSection}>To Katahdin</div>
              <div className={styles.statsWidgetRow}>
                <span>Remaining</span>
                <strong>{fmtDist(stats.remainingKm, 0)}</strong>
              </div>
              {stats.pace7day > 0 && (
                <div className={styles.statsWidgetRow}>
                  <span>Pace (7d avg)</span>
                  <strong>{fmtDist(stats.pace7day, 1)}/day</strong>
                </div>
              )}
              {stats.etaDate && (
                <div className={styles.statsWidgetRow}>
                  <span>ETA</span>
                  <strong>{stats.etaDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
