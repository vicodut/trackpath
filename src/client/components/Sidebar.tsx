import { TrackingPoint } from '../types';
import { AddPointForm } from './AddPointForm';
import { PointCard } from './PointCard';

interface SidebarProps {
  points: TrackingPoint[];
  totalDistanceKm: number;
  onSelectPoint: (point: TrackingPoint) => void;
  onDeletePoint: (id: number) => void;
  onAddPoint: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null }) => Promise<boolean>;
  onPickFromMap: () => void;
  pickingFromMap: boolean;
  pickedCoords: { lat: number; lng: number } | null;
}

export function Sidebar({
  points,
  totalDistanceKm,
  onSelectPoint,
  onDeletePoint,
  onAddPoint,
  onPickFromMap,
  pickingFromMap,
  pickedCoords,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Tracking Points</h2>
        <div className="stats">
          <span>Points: <strong>{points.length}</strong></span>
          <span>Distance: <strong>{totalDistanceKm.toFixed(1)}</strong> km</span>
        </div>
      </div>
      <AddPointForm
        onSubmit={onAddPoint}
        onPickFromMap={onPickFromMap}
        pickingFromMap={pickingFromMap}
        pickedCoords={pickedCoords}
      />
      <div className="points-list">
        {[...points].reverse().map((pt) => (
          <PointCard
            key={pt.id}
            point={pt}
            onSelect={onSelectPoint}
            onDelete={onDeletePoint}
          />
        ))}
      </div>
    </div>
  );
}
