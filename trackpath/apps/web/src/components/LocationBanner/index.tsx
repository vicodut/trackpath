import { useMemo } from 'react';
import type { TrackingPoint } from '../../types';
import { haversine } from '../../lib/geo';
import { useUnit } from '../../hooks/useUnit';
import { TRIP_START } from '../../lib/constants';
import styles from './LocationBanner.module.css';

interface LocationBannerProps {
  points: TrackingPoint[];
  trailProgressKm: number | null;
}

export function LocationBanner({ points, trailProgressKm }: LocationBannerProps) {
  const { fmtDist } = useUnit();

  const info = useMemo(() => {
    const now = new Date();
    const msIntoTrip = now.getTime() - TRIP_START.getTime();
    const tripStarted = msIntoTrip >= 0;
    const daysUntilStart = Math.ceil(-msIntoTrip / 86400000);
    const dayOnTrail = tripStarted ? Math.floor(msIntoTrip / 86400000) + 1 : 0;

    const today = now.toISOString().slice(0, 10);
    const todayPts = [...points]
      .filter(p => !p.garminId?.startsWith('manual-') && p.timestamp.slice(0, 10) === today)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let todayKm = 0;
    for (let i = 1; i < todayPts.length; i++) {
      const d = haversine(
        todayPts[i - 1].latitude, todayPts[i - 1].longitude,
        todayPts[i].latitude, todayPts[i].longitude,
      );
      if (d < 100) todayKm += d;
    }

    return { tripStarted, daysUntilStart, dayOnTrail, todayKm };
  }, [points]);

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
      <span className={styles.bannerText}>TODAY</span>
      <span className={styles.bannerValue}>{fmtDist(info.todayKm)}</span>
      {trailProgressKm != null && trailProgressKm > 0 && (
        <>
          <span className={styles.bannerDot}>·</span>
          <span className={styles.bannerText}>TRAIL</span>
          <span className={styles.bannerValue}>{fmtDist(trailProgressKm, 0)}</span>
        </>
      )}
    </div>
  );
}
