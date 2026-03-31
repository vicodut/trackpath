import type { TrackingPoint } from '../../types';
import { TAG_EMOJIS } from '../../lib/constants';
import styles from './PointPopup.module.css';

interface PointPopupProps {
  point: TrackingPoint;
  trailDistanceKm?: number | null;
  trailElevationGain?: number | null;
  onClose: () => void;
}

export function PointPopup({ point, trailDistanceKm, trailElevationGain, onClose }: PointPopupProps) {
  const time = new Date(point.timestamp);
  const emoji = point.eventType ? TAG_EMOJIS[point.eventType] : null;

  return (
    <div className={styles.pointPopupOverlay} onClick={onClose}>
      <div className={styles.pointPopup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.pointPopupHeader}>
          <span className={styles.pointPopupType}>
            {emoji && <>{emoji} </>}
            {point.eventType || 'TRACKING'}
          </span>
          <button className={styles.pointPopupClose} onClick={onClose}>X</button>
        </div>
        <div className={styles.pointPopupTime}>
          {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        {point.message && (
          <div className={styles.pointPopupMessage}>{point.message}</div>
        )}
        {trailDistanceKm != null && trailDistanceKm > 0 && (
          <div className={styles.pointPopupTrailDist}>
            {trailDistanceKm.toFixed(1)} km · +{Math.round(trailElevationGain ?? 0)}m
          </div>
        )}
      </div>
    </div>
  );
}
