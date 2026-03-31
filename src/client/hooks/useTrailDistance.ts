import { useState, useEffect, useCallback } from 'react';

interface TrailPoint {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
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

function findClosestTrailIndex(trail: TrailPoint[], lat: number, lon: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < trail.length; i++) {
    const d = haversine(lat, lon, trail[i].lat, trail[i].lon);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}

export interface TrailSegment {
  distanceKm: number;
  elevationGain: number;
  coords: [number, number][];
}

export function useTrailDistance() {
  const [trail, setTrail] = useState<TrailPoint[] | null>(null);
  const [fullTrail, setFullTrail] = useState<[number, number][] | null>(null);

  useEffect(() => {
    fetch('/at-trail-elevation.json')
      .then(r => r.json())
      .then(setTrail)
      .catch(() => null);
    fetch('/at-trail.json')
      .then(r => r.json())
      .then(setFullTrail)
      .catch(() => null);
  }, []);

  const getSegment = useCallback((
    fromLat: number, fromLon: number,
    toLat: number, toLon: number,
  ): TrailSegment | null => {
    if (!trail || !fullTrail) return null;

    // Find closest points on the sampled trail for distance calculation
    const fromIdx = findClosestTrailIndex(trail, fromLat, fromLon);
    const toIdx = findClosestTrailIndex(trail, toLat, toLon);

    const distanceKm = Math.abs(trail[toIdx].distanceKm - trail[fromIdx].distanceKm);

    // Compute elevation gain along the sampled trail segment
    const startSample = Math.min(fromIdx, toIdx);
    const endSample = Math.max(fromIdx, toIdx);
    let elevationGain = 0;
    for (let i = startSample + 1; i <= endSample; i++) {
      const diff = trail[i].elevation - trail[i - 1].elevation;
      if (diff > 0) elevationGain += diff;
    }

    // Find closest points on the full trail for the polyline segment
    const fullFromIdx = findClosestFullTrailIndex(fullTrail, fromLat, fromLon);
    const fullToIdx = findClosestFullTrailIndex(fullTrail, toLat, toLon);

    const startIdx = Math.min(fullFromIdx, fullToIdx);
    const endIdx = Math.max(fullFromIdx, fullToIdx);
    const coords = fullTrail.slice(startIdx, endIdx + 1);

    return { distanceKm, elevationGain, coords };
  }, [trail, fullTrail]);

  const getDistanceKm = useCallback((
    fromLat: number, fromLon: number,
    toLat: number, toLon: number,
  ): number | null => {
    if (!trail) return null;
    const fromIdx = findClosestTrailIndex(trail, fromLat, fromLon);
    const toIdx = findClosestTrailIndex(trail, toLat, toLon);
    return Math.abs(trail[toIdx].distanceKm - trail[fromIdx].distanceKm);
  }, [trail]);

  const getTrailKm = useCallback((lat: number, lon: number): number | null => {
    if (!trail) return null;
    const idx = findClosestTrailIndex(trail, lat, lon);
    return trail[idx].distanceKm;
  }, [trail]);

  return { getSegment, getDistanceKm, getTrailKm, loaded: !!trail && !!fullTrail };
}

function findClosestFullTrailIndex(trail: [number, number][], lat: number, lon: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  // Sample every 10th point for speed, then refine
  for (let i = 0; i < trail.length; i += 10) {
    const d = haversine(lat, lon, trail[i][0], trail[i][1]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  // Refine around the best match
  const start = Math.max(0, bestIdx - 10);
  const end = Math.min(trail.length - 1, bestIdx + 10);
  for (let i = start; i <= end; i++) {
    const d = haversine(lat, lon, trail[i][0], trail[i][1]);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return bestIdx;
}
