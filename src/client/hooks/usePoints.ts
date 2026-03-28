import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrackingPoint } from '../types';
import * as api from '../api/points';

export function usePoints() {
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [status, setStatus] = useState<{ message: string; type: '' | 'syncing' | 'success' }>({
    message: 'Ready',
    type: '',
  });

  const loadPoints = useCallback(async () => {
    try {
      const pts = await api.getPoints();
      setPoints(pts);
      const lastTime = pts.length > 0
        ? new Date(pts[pts.length - 1].timestamp).toLocaleString()
        : null;
      setStatus({ message: `Ready${lastTime ? ` — last: ${lastTime}` : ''}`, type: '' });
    } catch (err) {
      console.error('Failed to load points:', err);
    }
  }, []);

  const sync = useCallback(async () => {
    setStatus({ message: 'Syncing with inReach...', type: 'syncing' });
    try {
      const data = await api.syncPoints();
      setPoints(data.points);
      const lastTime = data.points.length > 0
        ? new Date(data.points[data.points.length - 1].timestamp).toLocaleString()
        : null;
      setStatus({ message: `Synced! ${data.synced} new points (${data.total} total)${lastTime ? ` — last: ${lastTime}` : ''}`, type: 'success' });
      return data;
    } catch (err) {
      setStatus({ message: `Sync failed: ${(err as Error).message}`, type: '' });
      return null;
    }
  }, []);

  const addPoint = useCallback(async (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null }) => {
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
    return points.map((pt, i) => {
      if (i === 0 || pt.velocity != null) return pt;
      const prev = points[i - 1];
      const distKm = haversine(prev.latitude, prev.longitude, pt.latitude, pt.longitude);
      const timeDiffH = (new Date(pt.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3600000;
      if (timeDiffH <= 0) return pt;
      return { ...pt, calculatedSpeedKmh: distKm / timeDiffH };
    });
  }, [points]);

  const totalDistanceKm = useMemo(() => {
    if (points.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += haversine(
        points[i - 1].latitude, points[i - 1].longitude,
        points[i].latitude, points[i].longitude,
      );
    }
    return total;
  }, [points]);

  // Auto-refresh every 30s
  useEffect(() => {
    loadPoints();
    const interval = setInterval(loadPoints, 30000);
    return () => clearInterval(interval);
  }, [loadPoints]);

  return { points: pointsWithSpeed, status, setStatus, sync, addPoint, removePoint, totalDistanceKm, loadPoints };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
