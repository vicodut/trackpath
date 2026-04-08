import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TrackingPoint } from '../types';
import * as api from '../api/points';
import { haversine } from '../lib/geo';

export function usePoints() {
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; type: '' | 'syncing' | 'success' }>({
    message: 'Ready',
    type: '',
  });

  const loadPoints = useCallback(async () => {
    try {
      const pts = await api.getPoints();
      const safePoints = Array.isArray(pts) ? pts : [];
      setPoints(safePoints);
      const lastTime = safePoints.length > 0
        ? new Date(safePoints[safePoints.length - 1].timestamp).toLocaleString()
        : null;
      setStatus({ message: `Ready${lastTime ? ` — last: ${lastTime}` : ''}`, type: '' });
    } catch (err) {
      console.error('Failed to load points:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setStatus({ message: 'Syncing with inReach...', type: 'syncing' });
    try {
      const data = await api.syncPoints();
      const safePoints = Array.isArray(data?.points) ? data.points : [];
      setPoints(safePoints);
      const lastTime = safePoints.length > 0
        ? new Date(safePoints[safePoints.length - 1].timestamp).toLocaleString()
        : null;
      setStatus({ message: `Synced! ${data.synced} new points (${data.total} total)${lastTime ? ` — last: ${lastTime}` : ''}`, type: 'success' });
      return data;
    } catch (err) {
      setStatus({ message: `Sync failed: ${(err as Error).message}`, type: '' });
      return null;
    }
  }, []);

  const addPoint = useCallback(async (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => {
    try {
      await api.addPoint(data);
      setStatus({ message: 'Point added!', type: 'success' });
      await loadPoints();
      return true;
    } catch (err) {
      setStatus({ message: `Failed: ${(err as Error).message}`, type: '' });
      return false;
    }
  }, [loadPoints]);

  const removePoint = useCallback(async (id: number) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    await api.deletePoint(id);
  }, []);

  const pointsWithSpeed = useMemo(() => {
    if (!Array.isArray(points)) return [];
    return points.map((pt, i) => {
      if (i === 0 || pt.velocity != null) return pt;
      const prev = points[i - 1];
      const distKm = haversine(prev.latitude, prev.longitude, pt.latitude, pt.longitude);
      const timeDiffH = (new Date(pt.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3600000;
      if (timeDiffH <= 0) return pt;
      return { ...pt, calculatedSpeedKmh: distKm / timeDiffH };
    });
  }, [points]);

  // Filter out manual points for distance/elevation — they are waypoints, not trail progress
  const garminPoints = useMemo(() =>
    points.filter(p => !p.garminId?.startsWith('manual-')),
  [points]);

  const totalElevationGain = useMemo(() => {
    if (garminPoints.length < 2) return 0;
    let gain = 0;
    for (let i = 1; i < garminPoints.length; i++) {
      if (garminPoints[i].altitude != null && garminPoints[i - 1].altitude != null) {
        const diff = garminPoints[i].altitude! - garminPoints[i - 1].altitude!;
        if (diff > 0) gain += diff;
      }
    }
    return gain;
  }, [garminPoints]);

  const totalDistanceKm = useMemo(() => {
    if (garminPoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < garminPoints.length; i++) {
      const d = haversine(
        garminPoints[i - 1].latitude, garminPoints[i - 1].longitude,
        garminPoints[i].latitude, garminPoints[i].longitude,
      );
      if (d > 100) continue; // skip unrealistic jumps
      total += d;
    }
    return total;
  }, [garminPoints]);

  // Auto-refresh every 30s, paused when tab is hidden
  useEffect(() => {
    loadPoints();
    let interval: ReturnType<typeof setInterval> | null = setInterval(loadPoints, 30000);

    const onVisibility = () => {
      if (document.hidden) {
        if (interval) { clearInterval(interval); interval = null; }
      } else {
        loadPoints();
        interval = setInterval(loadPoints, 30000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadPoints]);

  return { points: pointsWithSpeed, loading, status, setStatus, sync, addPoint, removePoint, totalDistanceKm, totalElevationGain, loadPoints };
}
