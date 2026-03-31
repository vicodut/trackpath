import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import { TrackingPoint, StravaActivity } from '../types';
import { AddPointForm } from './AddPointForm';
import { PointCard } from './PointCard';

const TAG_FILTERS = [
  { key: 'inreach', label: 'INREACH', emoji: '📡' },
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
  onAddSuccess?: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  isAdmin: boolean;
  forceFormOpen?: boolean;
}

function SidebarContent({
  points, totalDistanceKm, totalElevationGain, stravaActivities,
  onSelectPoint, onDeletePoint, onAddPoint, onFormToggle, onAddSuccess, pickedCoords, isAdmin, forceFormOpen,
}: SidebarProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const stravaElevation = useMemo(() =>
    stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
  [stravaActivities]);

  const totalElev = totalElevationGain + stravaElevation;

  const filteredPoints = useMemo(() => {
    if (activeFilters.size === 0) return points;
    return points.filter(pt => {
      for (const f of activeFilters) {
        if (f === 'inreach' && pt.garminId && !pt.garminId.startsWith('manual-')) return true;
        if (f !== 'inreach' && pt.eventType === f) return true;
      }
      return false;
    });
  }, [points, activeFilters]);

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
            className={`tag-filter-btn ${activeFilters.has(key) ? 'active' : ''}`}
            onClick={() => toggleFilter(key)}
          >
            {emoji}
          </button>
        ))}
      </div>
      {isAdmin && (
        <AddPointForm
          onSubmit={onAddPoint}
          onFormToggle={onFormToggle}
          onSuccess={onAddSuccess}
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

const TAGS = ['resupply', 'poop', 'hostel', 'camp', 'shelter', 'water', 'viewpoint'] as const;
const TAG_EMOJIS: Record<string, string> = {
  resupply: '🛒', poop: '💩', hostel: '🏠', camp: '⛺',
  shelter: '🛖', water: '💧', viewpoint: '👀',
};

function MobileAddDrawer({ snap, setSnap, onAddPoint, onAddSuccess, onFormToggle, pickedCoords }: {
  snap: number | string | null;
  setSnap: (s: number | string | null) => void;
  onAddPoint: SidebarProps['onAddPoint'];
  onAddSuccess?: () => void;
  onFormToggle: (open: boolean) => void;
  pickedCoords: { lat: number; lng: number } | null;
}) {
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async () => {
    if (!pickedCoords) return;
    const ok = await onAddPoint({
      latitude: pickedCoords.lat,
      longitude: pickedCoords.lng,
      message: msg.trim() || null,
      tag: tag || null,
    });
    if (ok) {
      setTag('');
      setMsg('');
      onFormToggle(false);
      onAddSuccess?.();
    }
  };

  const handleClose = () => {
    setTag('');
    setMsg('');
    onFormToggle(false);
    onAddSuccess?.();
  };

  return (
    <Drawer.Root
      open
      modal={false}
      snapPoints={[0.45, 0.8]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content className="drawer-content">
          <div className="drawer-handle">
            <div className="drawer-handle-bar" />
          </div>
          <div className="mobile-add-form">
            <div className="mobile-add-header">
              <span className="mobile-add-title">ADD POINT</span>
              {pickedCoords && (
                <span className="mobile-add-coords">
                  {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                </span>
              )}
              <button className="mobile-add-close" onClick={handleClose}>X</button>
            </div>
            {!pickedCoords && (
              <p className="pick-hint active">TAP MAP TO SET COORDINATES</p>
            )}
            <div className="add-form-tag-grid">
              {TAGS.map((t) => (
                <button
                  key={t}
                  className={`add-form-tag-btn ${tag === t ? 'active' : ''}`}
                  onClick={() => setTag(tag === t ? '' : t)}
                >
                  <span className="add-form-tag-emoji">{TAG_EMOJIS[t]}</span>
                  <span className="add-form-tag-label">{t}</span>
                </button>
              ))}
            </div>
            <textarea
              className="mobile-add-message"
              placeholder="Message (optional)"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={2}
            />
            <button
              className="mobile-add-submit"
              onClick={handleSubmit}
              disabled={!pickedCoords}
            >
              SUBMIT
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Sidebar(props: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [snap, setSnap] = useState<number | string | null>(0.85);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-expand drawer when form is forced open (map tap)
  useEffect(() => {
    if (props.forceFormOpen && isMobile) {
      setSnap(0.85);
    }
  }, [props.forceFormOpen, isMobile]);

  if (!isMobile) {
    return (
      <div className="sidebar">
        <SidebarContent {...props} />
      </div>
    );
  }

  // On mobile, drawer only shows the add form (not the full point list)
  if (!props.forceFormOpen || !props.isAdmin) return null;

  return (
    <MobileAddDrawer
      snap={snap}
      setSnap={setSnap}
      onAddPoint={props.onAddPoint}
      onAddSuccess={props.onAddSuccess}
      onFormToggle={props.onFormToggle}
      pickedCoords={props.pickedCoords}
    />
  );
}
