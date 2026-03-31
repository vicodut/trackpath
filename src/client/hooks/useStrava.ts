import { useState, useEffect, useCallback } from 'react';
import type { StravaActivity } from '../types';

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
      .then(setActivities)
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    const res = await fetch('/api/strava/connect', { credentials: 'include' });
    const data = await res.json() as { url?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('Strava connect error:', data);
    }
  }, []);

  const syncActivities = useCallback(async () => {
    const res = await fetch('/api/strava/sync', { method: 'POST' });
    const data = await res.json() as { activities?: StravaActivity[] };
    if (data.activities) setActivities(data.activities);
  }, []);

  return { activities, connected, connect, syncActivities };
}
