import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import { TrackingPoint, StravaActivity } from '../types';
import { AddPointForm } from './AddPointForm';
import { PointCard } from './PointCard';

interface SidebarProps {
  points: TrackingPoint[];
  totalDistanceKm: number;
  totalElevationGain: number;
  stravaActivities: StravaActivity[];
  onSelectPoint: (point: TrackingPoint) => void;
  onDeletePoint: (id: number) => void;
  onAddPoint: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => Promise<boolean>;
  onFormToggle: (open: boolean) => void;
  pickedCoords: { lat: number; lng: number } | null;
  isAdmin: boolean;
  forceFormOpen?: boolean;
}

function SidebarContent({
  points, totalDistanceKm, totalElevationGain, stravaActivities,
  onSelectPoint, onDeletePoint, onAddPoint, onFormToggle, pickedCoords, isAdmin, forceFormOpen,
}: SidebarProps) {
  const stravaElevation = useMemo(() =>
    stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
  [stravaActivities]);

  const totalElev = totalElevationGain + stravaElevation;

  return (
    <>
      <div className="sidebar-header">
        <h2>TRAIL_LOG</h2>
        <div className="stats">
          <span>PTS: <strong>{points.length}</strong></span>
          <span>DIST: <strong>{totalDistanceKm.toFixed(1)}</strong> km</span>
          <span>ELEV: <strong>{Math.round(totalElev)}</strong> m</span>
        </div>
      </div>
      {isAdmin && (
        <AddPointForm
          onSubmit={onAddPoint}
          onFormToggle={onFormToggle}
          pickedCoords={pickedCoords}
          forceOpen={forceFormOpen}
        />
      )}
      <div className="points-list">
        {[...points].reverse().map((pt) => (
          <PointCard
            key={pt.id}
            point={pt}
            onSelect={onSelectPoint}
            onDelete={isAdmin ? onDeletePoint : undefined}
          />
        ))}
      </div>
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (!isMobile) {
    return (
      <div className="sidebar">
        <SidebarContent {...props} />
      </div>
    );
  }

  return (
    <Drawer.Root
      open
      modal={false}
      snapPoints={[0.15, 0.4, 0.85]}
      defaultSnap={0.15}
    >
      <Drawer.Portal>
        <Drawer.Content className="drawer-content">
          <div className="drawer-handle">
            <div className="drawer-handle-bar" />
          </div>
          <div className="drawer-inner">
            <SidebarContent {...props} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
