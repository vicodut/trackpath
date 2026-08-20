import { useState, useEffect, useCallback } from 'react';
import type { StravaActivity } from '../types';
import { TRIP_START } from '../lib/constants';

function filterActivities(data: unknown): StravaActivity[] {
  return (Array.isArray(data) ? data : []).filter(
    (a: StravaActivity) => a.startDate && new Date(a.startDate) >= TRIP_START,
  );
}

export function useStrava() {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetch('/api/strava/status')
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setConnected(d.connected))
      .catch(() => setConnected(false));
    fetch('/api/strava/activities')
      .then((r) => r.json())
      .then((data) => setActivities(filterActivities(data)))
      .catch((err: unknown) => console.error('Failed to load Strava activities:', err));
  }, []);

  const connect = useCallback(async () => {
    try {
      const res = await fetch('/api/strava/connect', { credentials: 'include' });
      const data = await res.json() as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Strava connect error:', data);
      }
    } catch (err) {
      console.error('Strava connect failed:', err);
    }
  }, []);

  const syncActivities = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      const res = await fetch('/api/strava/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });
      const data = await res.json() as { activities?: StravaActivity[] };
      if (data.activities) setActivities(filterActivities(data.activities));
    } catch (err) {
      console.error('Strava sync failed:', err);
    }
  }, []);

  return { activities, connected, connect, syncActivities };
}
