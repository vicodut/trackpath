import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TrackingPoint } from '../types';
import * as api from '../api/points';
import { haversine } from '../lib/geo';
import { TRIP_START } from '../lib/constants';

export function usePoints() {
  const [points, setPoints] = useState<TrackingPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; type: '' | 'syncing' | 'success' }>({
    message: 'Ready',
    type: '',
  });

  const applyPoints = useCallback((pts: TrackingPoint[]) => {
    const safePoints = (Array.isArray(pts) ? pts : []).filter(
      (p) => new Date(p.timestamp) >= TRIP_START,
    );
    setPoints(safePoints);
    const lastTime = safePoints.length > 0
      ? new Date(safePoints[safePoints.length - 1].timestamp).toLocaleString()
      : null;
    setStatus({ message: `Ready${lastTime ? ` — last: ${lastTime}` : ''}`, type: '' });
    setLoading(false);
  }, []);

  // SSE stream — reconnects automatically; falls back to REST on persistent failure
  useEffect(() => {
    let es: EventSource | null = null;
    let backoffMs = 2000;
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let dead = false;

    function connect() {
      es = new EventSource('/api/stream');

      es.onmessage = (event) => {
        try {
          const pts: TrackingPoint[] = JSON.parse(event.data);
          applyPoints(pts);
          backoffMs = 2000; // reset on success
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (dead) return;
        backoffTimer = setTimeout(() => {
          if (!dead) connect();
        }, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
      };
    }

    connect();

    return () => {
      dead = true;
      es?.close();
      if (backoffTimer) clearTimeout(backoffTimer);
    };
  }, [applyPoints]);

  const sync = useCallback(async () => {
    setStatus({ message: 'Syncing with inReach...', type: 'syncing' });
    try {
      const data = await api.syncPoints();
      const safePoints = Array.isArray(data?.points) ? data.points : [];
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
      return true;
    } catch (err) {
      setStatus({ message: `Failed: ${(err as Error).message}`, type: '' });
      return false;
    }
  }, []);

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

  return { points: pointsWithSpeed, loading, status, setStatus, sync, addPoint, removePoint, totalDistanceKm, totalElevationGain };
}
