import { useState, useMemo } from 'react';
import type { TrackingPoint, StravaActivity } from '../../types';
import { PointCard } from '../PointCard';
import styles from './TrailLogPage.module.css';

const TAG_FILTERS = [
  { key: 'inreach', emoji: '📡' },
  { key: 'resupply', emoji: '🛒' },
  { key: 'poop', emoji: '💩' },
  { key: 'hostel', emoji: '🏠' },
  { key: 'camp', emoji: '⛺' },
  { key: 'shelter', emoji: '🛖' },
  { key: 'water', emoji: '💧' },
  { key: 'viewpoint', emoji: '👀' },
] as const;

interface TrailLogPageProps {
  points: TrackingPoint[];
  totalDistanceKm: number;
  totalElevationGain: number;
  stravaActivities: StravaActivity[];
  onSelectPoint: (point: TrackingPoint) => void;
  onDeletePoint: (id: number) => void;
  isAdmin: boolean;
  onClose: () => void;
}

export function TrailLogPage({
  points, totalDistanceKm, totalElevationGain, stravaActivities,
  onSelectPoint, onDeletePoint, isAdmin, onClose,
}: TrailLogPageProps) {
  const [activeFilters, setActiveFilters] = useState(new Set());

  const stravaElevation = useMemo(() =>
    stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
  [stravaActivities]);

  const totalElev = totalElevationGain + stravaElevation;

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
    <div className={styles.trailLogPage}>
      <div className={styles.trailLogHeader}>
        <div>
          <h2>TRAIL_LOG</h2>
          <div className="stats">
            <span>PTS: <strong>{filteredPoints.length}</strong></span>
            <span>DIST: <strong>{totalDistanceKm.toFixed(1)}</strong> km</span>
            <span>ELEV: <strong>{Math.round(totalElev)}</strong> m</span>
          </div>
        </div>
        <button onClick={onClose}>CLOSE</button>
      </div>
      <div className={styles.tagFilters}>
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
      <div className={styles.pointsList}>
        {[...filteredPoints].reverse().map((pt) => (
          <PointCard
            key={pt.id}
            point={pt}
            onSelect={(p) => { onSelectPoint(p); onClose(); }}
            onDelete={isAdmin ? onDeletePoint : undefined}
          />
        ))}
      </div>
    </div>
  );
}
