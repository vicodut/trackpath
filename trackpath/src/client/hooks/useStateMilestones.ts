import { useState, useEffect, useCallback } from 'react';

export interface StateMilestone {
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

interface ATHighlight {
  id: string;
  category: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
}

export function useStateMilestones(
  getTrailKm: (lat: number, lon: number) => number | null,
  trailLoaded: boolean,
): StateMilestone[] {
  const [milestones, setMilestones] = useState<StateMilestone[]>([]);

  const compute = useCallback(() => {
    if (!trailLoaded) return;
    fetch('/at-highlights.json')
      .then(r => r.json())
      .then((highlights: ATHighlight[]) => {
        const borders = highlights.filter(h => h.category === 'state-border');
        const result: StateMilestone[] = [];
        for (const b of borders) {
          const km = getTrailKm(b.lat, b.lon);
          if (km != null && km > 0) {
            result.push({ name: b.name, lat: b.lat, lon: b.lon, distanceKm: km });
          }
        }
        result.sort((a, b) => a.distanceKm - b.distanceKm);
        setMilestones(result);
      })
      .catch(() => null);
  }, [getTrailKm, trailLoaded]);

  useEffect(() => {
    compute();
  }, [compute]);

  return milestones;
}
