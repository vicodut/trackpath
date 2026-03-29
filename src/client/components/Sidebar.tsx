import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import { TrackingPoint, StravaActivity } from '../types';
import { AddPointForm } from './AddPointForm';
import { PointCard } from './PointCard';

const TAG_FILTERS = [
  { key: 'all', label: 'ALL', emoji: '' },
  { key: 'resupply', label: 'RESUPPLY', emoji: '🛒' },
  { key: 'poop', label: 'POOP', emoji: '💩' },
  { key: 'hostel', label: 'HOSTEL', emoji: '🏠' },
  { key: 'camp', label: 'CAMP', emoji: '⛺' },
  { key: 'shelter', label: 'SHELTER', emoji: '🛖' },
  { key: 'water', label: 'WATER', emoji: '💧' },
  { key: 'viewpoint', label: 'VIEW', emoji: '👀' },
] as const;

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
  const [activeFilter, setActiveFilter] = useState('all');

  const stravaElevation = useMemo(() =>
    stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
  [stravaActivities]);

  const totalElev = totalElevationGain + stravaElevation;

  const filteredPoints = useMemo(() => {
    if (activeFilter === 'all') return points;
    return points.filter(pt => pt.eventType === activeFilter);
  }, [points, activeFilter]);

  return (
    <>
      <div className="sidebar-header">
        <h2>TRAIL_LOG</h2>
        <div className="stats">
          <span>PTS: <strong>{filteredPoints.length}</strong></span>
          <span>DIST: <strong>{totalDistanceKm.toFixed(1)}</strong> km</span>
          <span>ELEV: <strong>{Math.round(totalElev)}</strong> m</span>
        </div>
      </div>
      <div className="tag-filters">
        {TAG_FILTERS.map(({ key, emoji }) => (
          <button
            key={key}
            className={`tag-filter-btn ${activeFilter === key ? 'active' : ''}`}
            onClick={() => setActiveFilter(key)}
          >
            {key === 'all' ? 'ALL' : emoji}
          </button>
        ))}
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
        {[...filteredPoints].reverse().map((pt) => (
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
