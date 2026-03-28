import { TrackingPoint } from '../types';

interface PointCardProps {
  point: TrackingPoint;
  onSelect: (point: TrackingPoint) => void;
  onDelete: (id: number) => void;
}

export function PointCard({ point, onSelect, onDelete }: PointCardProps) {
  const time = new Date(point.timestamp).toLocaleString();

  return (
    <div className="point-card" onClick={() => onSelect(point)}>
      <div className="point-time">{time}</div>
      <div className="point-coords">
        {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
      </div>
      {point.message && (
        <div className="point-message">"{point.message}"</div>
      )}
      <div className="point-meta">
        <span>
          {point.altitude ? `Alt: ${point.altitude.toFixed(0)}m` : ''}
          {point.velocity ? ` | ${point.velocity} km/h` : ''}
          {point.eventType ? ` | ${point.eventType}` : ''}
        </span>
        <button
          className="delete-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(point.id); }}
        >
          remove
        </button>
      </div>
    </div>
  );
}
