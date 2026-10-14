import { memo } from 'react';
import type { TrackingPoint } from '../../types';
import { TAG_EMOJIS } from '../../lib/constants';
import { useUnit } from '../../hooks/useUnit';
import styles from './PointPopup.module.css';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function AltSparkline({ altitudes }: { altitudes: number[] }) {
  if (altitudes.length < 3) return null;
  const W = 220, H = 32;
  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  const range = max - min || 1;
  const pts = altitudes.map((a, i) => {
    const x = (i / (altitudes.length - 1)) * W;
    const y = H - ((a - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPts = [`0,${H}`, ...pts, `${W},${H}`].join(' ');
  return (
    <div className={styles.sparklineWrap}>
      <span className={styles.sparklineLabel}>{min.toFixed(0)}m</span>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={styles.sparkline}>
        <polygon points={fillPts} className={styles.sparklineFill} />
        <polyline points={pts.join(' ')} className={styles.sparklineLine} />
      </svg>
      <span className={styles.sparklineLabel}>{max.toFixed(0)}m</span>
    </div>
  );
}

interface PointPopupProps {
  point: TrackingPoint;
  trailDistanceKm?: number | null;
  trailElevationGain?: number | null;
  nearbyAltitudes?: number[];
  onClose: () => void;
}

export const PointPopup = memo(function PointPopup({
  point, trailDistanceKm, trailElevationGain, nearbyAltitudes = [], onClose,
}: PointPopupProps) {
  const time = new Date(point.timestamp);
  const emoji = point.eventType ? TAG_EMOJIS[point.eventType] : null;
  const { fmtDist } = useUnit();

  return (
    <div className={styles.pointPopupOverlay} onClick={onClose}>
      <div className={styles.pointPopup} onClick={(e) => { e.stopPropagation(); }}>
        <div className={styles.pointPopupHeader}>
          <span className={styles.pointPopupType}>
            {emoji && <>{emoji} </>}
            {point.eventType || 'TRACKING'}
          </span>
          <button className={styles.pointPopupClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.pointPopupTimeRow}>
          <span className={styles.pointPopupTime}>
            {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={styles.pointPopupRelTime}>{timeAgo(time)}</span>
        </div>

        <div className={styles.pointPopupCoords}>
          {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
        </div>

        <div className={styles.pointPopupDetails}>
          {point.altitude != null && (
            <span>ALT: {point.altitude.toFixed(0)}m</span>
          )}
          {point.velocity ? (
            <span>SPEED: {point.velocity} km/h</span>
          ) : point.calculatedSpeedKmh ? (
            <span>SPEED: ~{point.calculatedSpeedKmh.toFixed(1)} km/h</span>
          ) : null}
        </div>

        {nearbyAltitudes.length >= 3 && (
          <AltSparkline altitudes={nearbyAltitudes} />
        )}

        {point.message && (
          <div className={styles.pointPopupMessage}>{point.message}</div>
        )}

        {trailDistanceKm != null && trailDistanceKm > 0 && (
          <div className={styles.pointPopupTrailDist}>
            {fmtDist(trailDistanceKm)} · +{Math.round(trailElevationGain ?? 0)}m to here
          </div>
        )}
      </div>
    </div>
  );
});
