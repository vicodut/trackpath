import { useMemo, useState, useEffect } from 'react';
import type { TrackingPoint, StravaActivity } from '../../types';
import type { SyncPeriod } from '../../api/syncPeriods';
import { haversine } from '../../lib/geo';
import { useUnit } from '../../hooks/useUnit';
import { TRIP_START } from '../../lib/constants';
import { fetchSyncPeriods } from '../../api/syncPeriods';
import { MS_PER_DAY, earliestPeriodStartMs, daysInPeriods } from '../../lib/tripDays';
import { filterHikeActivities, sumHikeDistanceKm } from '../../lib/stravaHike';
import styles from './LocationBanner.module.css';

interface LocationBannerProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
}

/**
 * Days on trail = sum of days actually inside a configured sync period —
 * gaps between periods (e.g. time at home) don't count. A period the
 * current moment falls inside contributes only up to today, not its full
 * length; a period entirely in the future contributes nothing yet.
 */
function daysOnTrailFromPeriods(periods: SyncPeriod[], nowMs: number): { tripStarted: boolean; daysUntilStart: number; dayOnTrail: number } {
  const earliestStartMs = earliestPeriodStartMs(periods);

  if (nowMs < earliestStartMs) {
    return { tripStarted: false, daysUntilStart: Math.ceil((earliestStartMs - nowMs) / MS_PER_DAY), dayOnTrail: 0 };
  }

  return { tripStarted: true, daysUntilStart: 0, dayOnTrail: daysInPeriods(periods, nowMs).length };
}

export function LocationBanner({ points, stravaActivities }: LocationBannerProps) {
  const { fmtDist } = useUnit();
  const [periods, setPeriods] = useState<SyncPeriod[]>([]);

  useEffect(() => {
    fetchSyncPeriods().then(setPeriods).catch(() => { /* keep the empty fallback */ });
  }, []);

  const info = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();

    // No periods configured yet — fall back to plain calendar days since the
    // hardcoded trip start, same as before periods existed.
    const { tripStarted, daysUntilStart, dayOnTrail } = periods.length > 0
      ? daysOnTrailFromPeriods(periods, nowMs)
      : (() => {
        const msIntoTrip = nowMs - TRIP_START.getTime();
        return {
          tripStarted: msIntoTrip >= 0,
          daysUntilStart: Math.ceil(-msIntoTrip / MS_PER_DAY),
          dayOnTrail: msIntoTrip >= 0 ? Math.floor(msIntoTrip / MS_PER_DAY) + 1 : 0,
        };
      })();

    const today = now.toISOString().slice(0, 10);
    const todayGarminPts = [...points]
      .filter(p => !p.garminId?.startsWith('manual-') && p.timestamp.slice(0, 10) === today)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Rest day = no Garmin ping received today, regardless of any Strava activity.
    const isRestDay = todayGarminPts.length === 0;

    let garminTodayKm = 0;
    for (let i = 1; i < todayGarminPts.length; i++) {
      const d = haversine(
        todayGarminPts[i - 1].latitude, todayGarminPts[i - 1].longitude,
        todayGarminPts[i].latitude, todayGarminPts[i].longitude,
      );
      if (d < 100) garminTodayKm += d;
    }

    // Matches StatsPage's + Sidebar's calculation so all three never disagree.
    const hikeActivities = filterHikeActivities(stravaActivities, periods);

    const stravaTodayKm = sumHikeDistanceKm(hikeActivities.filter(a => a.startDate?.slice(0, 10) === today));

    // Strava is the primary distance source; add Garmin's GPS distance on
    // top when the device actually reported in today.
    const todayKm = stravaTodayKm + (isRestDay ? 0 : garminTodayKm);

    const trailTotalKm = sumHikeDistanceKm(hikeActivities);

    return { tripStarted, daysUntilStart, dayOnTrail, isRestDay, todayKm, trailTotalKm };
  }, [points, stravaActivities, periods]);

  if (!info.tripStarted) {
    return (
      <div className={styles.banner}>
        <span className={styles.bannerHighlight}>TRIP STARTS IN {info.daysUntilStart} DAYS</span>
        <span className={styles.bannerDot}>·</span>
        <span className={styles.bannerText}>SPRINGER MTN, GA</span>
      </div>
    );
  }

  return (
    <div className={styles.banner}>
      <span className={styles.bannerHighlight}>DAY {info.dayOnTrail}</span>
      <span className={styles.bannerDot}>·</span>
      {info.isRestDay ? (
        <span className={styles.bannerText}>REST DAY 💤</span>
      ) : (
        <>
          <span className={styles.bannerText}>TODAY</span>
          <span className={styles.bannerValue}>{fmtDist(info.todayKm)}</span>
        </>
      )}
      {info.trailTotalKm > 0 && (
        <>
          <span className={styles.bannerDot}>·</span>
          <span className={styles.bannerText}>TRAIL</span>
          <span className={styles.bannerValue}>{fmtDist(info.trailTotalKm, 0)}</span>
        </>
      )}
    </div>
  );
}
