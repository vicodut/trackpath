import type { TrackingPoint } from '../../types';
import styles from './PointCard.module.css';

const TAG_EMOJIS: Record<string, string> = {
  poop: '💩',
  resupply: '🛒',
  hostel: '🏠',
  camp: '⛺',
  shelter: '🛖',
  water: '💧',
  viewpoint: '👀',
};

interface PointCardProps {
  point: TrackingPoint;
  onSelect: (point: TrackingPoint) => void;
  onDelete?: (id: number) => void;
}

export function PointCard({ point, onSelect, onDelete }: PointCardProps) {
  const time = new Date(point.timestamp).toLocaleString();
  const emoji = point.eventType ? TAG_EMOJIS[point.eventType] : null;

  return (
    <div className={styles.pointCard} onClick={() => onSelect(point)}>
      <div className={styles.pointTime}>{emoji && <>{emoji} · </>}{time}</div>
      <div className={styles.pointCoords}>
        {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
      </div>
      {point.message && (
        <div className={styles.pointMessage}>"{point.message}"</div>
      )}
      <div className={styles.pointMeta}>
        <span>
          {point.altitude ? `Alt: ${point.altitude.toFixed(0)}m` : ''}
          {point.velocity ? ` | ${point.velocity} km/h` : point.calculatedSpeedKmh ? ` | ~${point.calculatedSpeedKmh.toFixed(1)} km/h` : ''}
          {point.eventType ? ` | ${point.eventType}` : ''}
        </span>
        {onDelete && (
          <button
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(point.id); }}
          >
            remove
          </button>
        )}
      </div>
    </div>
  );
}
