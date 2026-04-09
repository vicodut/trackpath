import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import type { TrackingPoint, StravaActivity } from '../../types';
import { TAGS, TAG_EMOJIS } from '../../lib/constants';
import { AddPointForm } from '../AddPointForm';
import { PointCard } from '../PointCard';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useUnit } from '../../hooks/useUnit';
import styles from './Sidebar.module.css';

const AT_TOTAL_KM = 3507;

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
  loading?: boolean;
  totalDistanceKm: number;
  totalElevationGain: number;
  trailProgressKm?: number | null;
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

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ padding: '10px 12px', borderBottom: 'var(--ghost-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ height: 10, width: '55%' }} />
          <div className="skeleton" style={{ height: 8, width: '35%' }} />
        </div>
      ))}
    </>
  );
}

function TrailProgress({ trailProgressKm }: { trailProgressKm: number }) {
  const pct = Math.min((trailProgressKm / AT_TOTAL_KM) * 100, 100);
  return (
    <div className={styles.trailProgress}>
      <div className={styles.trailProgressHeader}>
        <span className={styles.trailProgressLabel}>AT_PROGRESS</span>
        <span className={styles.trailProgressValue}>{trailProgressKm.toFixed(0)} / {AT_TOTAL_KM} km</span>
      </div>
      <div className={styles.trailProgressBar}>
        <div className={styles.trailProgressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.trailProgressPct}>{pct.toFixed(1)}%</div>
    </div>
  );
}

function SidebarContent({
  points, loading, totalDistanceKm, totalElevationGain, trailProgressKm, stravaActivities,
  onSelectPoint, onDeletePoint, onAddPoint, onFormToggle, onAddSuccess, pickedCoords, isAdmin, forceFormOpen,
}: SidebarProps) {
  const [activeFilters, setActiveFilters] = useState(new Set());
  const { fmtDist } = useUnit();

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      {trailProgressKm != null && trailProgressKm > 0 && (
        <TrailProgress trailProgressKm={trailProgressKm} />
      )}
      <div className={styles.sidebarHeader}>
        <h2>TRAIL_LOG</h2>
        <div className={styles.stats}>
          <span>PTS: <strong>{filteredPoints.length}</strong></span>
          <span>DIST: <strong>{fmtDist(totalDistanceKm)}</strong></span>
          <span>ELEV: <strong>{Math.round(totalElev)}</strong> m</span>
        </div>
      </div>
      <div className={styles.tagFilters}>
        {TAG_FILTERS.map(({ key, emoji }) => (
          <button
            key={key}
            className={`${styles.tagFilterBtn} ${activeFilters.has(key) ? styles.active : ''}`}
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
      <div className={styles.pointsList}>
        {loading ? (
          <SkeletonCards />
        ) : (
          [...filteredPoints].reverse().map((pt) => (
            <PointCard
              key={pt.id}
              point={pt}
              onSelect={onSelectPoint}
              onDelete={isAdmin ? onDeletePoint : undefined}
            />
          ))
        )}
      </div>
    </>
  );
}

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
      onOpenChange={(open) => { if (!open) handleClose(); }}
      modal={false}
      snapPoints={[0.45, 0.85]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content className={styles.drawerContent}>
          <div className={styles.drawerHandle}>
            <div className={styles.drawerHandleBar} />
          </div>
          <div className={styles.mobileAddForm}>
            <div className={styles.mobileAddHeader}>
              <span className={styles.mobileAddTitle}>ADD POINT</span>
              {pickedCoords && (
                <span className={styles.mobileAddCoords}>
                  {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                </span>
              )}
              <button className={styles.mobileAddClose} onClick={handleClose}>X</button>
            </div>
            {!pickedCoords && (
              <p className={`${styles.pickHint} ${styles.active}`}>TAP MAP TO SET COORDINATES</p>
            )}
            <div className={styles.addFormTagGrid}>
              {TAGS.map((t) => (
                <button
                  key={t}
                  className={`${styles.addFormTagBtn} ${tag === t ? styles.active : ''}`}
                  onClick={() => setTag(tag === t ? '' : t)}
                >
                  <span className={styles.addFormTagEmoji}>{TAG_EMOJIS[t]}</span>
                  <span className={styles.addFormTagLabel}>{t}</span>
                </button>
              ))}
            </div>
            <textarea
              className={styles.mobileAddMessage}
              placeholder="Message (optional)"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={2}
            />
            <button
              className={styles.mobileAddSubmit}
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
  const isMobile = useIsMobile();
  const [snap, setSnap] = useState<number | string | null>(0.85);

  useEffect(() => {
    if (props.forceFormOpen && isMobile) setSnap(0.85);
  }, [props.forceFormOpen, isMobile]);

  if (!isMobile) {
    return (
      <div className={styles.sidebar}>
        <SidebarContent {...props} />
      </div>
    );
  }

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
