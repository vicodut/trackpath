import { TrackingPoint } from '../types';

const TAG_EMOJIS: Record<string, string> = {
  poop: '💩',
  resupply: '🛒',
  hostel: '🏠',
  camp: '⛺',
  shelter: '🛖',
  water: '💧',
  viewpoint: '👀',
};

interface PointPopupProps {
  point: TrackingPoint;
  onClose: () => void;
}

export function PointPopup({ point, onClose }: PointPopupProps) {
  const time = new Date(point.timestamp);
  const emoji = point.eventType ? TAG_EMOJIS[point.eventType] : null;

  return (
    <div className="point-popup-overlay" onClick={onClose}>
      <div className="point-popup" onClick={(e) => e.stopPropagation()}>
        <div className="point-popup-header">
          <span className="point-popup-type">
            {emoji && <>{emoji} </>}
            {point.eventType || 'TRACKING'}
          </span>
          <button className="point-popup-close" onClick={onClose}>X</button>
        </div>
        <div className="point-popup-time">
          {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="point-popup-coords">
          {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
        </div>
        <div className="point-popup-details">
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
          <div className="point-popup-message">{point.message}</div>
        )}
      </div>
    </div>
  );
}
