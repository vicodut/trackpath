import { useState, useEffect, useCallback } from 'react';

interface AdminStatus {
  garmin: {
    configured: boolean;
    mapshareId: string | null;
    totalPoints: number;
    lastPointTime: string | null;
    pollIntervalMin: number;
  };
  strava: {
    connected: boolean;
    athleteId: string | null;
    totalActivities: number;
    lastActivityDate: string | null;
    lastActivityName: string | null;
  };
  logs: { source: string; time: string; message: string }[];
}

interface AdminPageProps {
  onClose: () => void;
  onStravaConnect: () => void;
  onStravaSync: () => void;
  onGarminSync: () => void;
  syncing: boolean;
}

export function AdminPage({ onClose, onStravaConnect, onStravaSync, onGarminSync, syncing }: AdminPageProps) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [syncingGarmin, setSyncingGarmin] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);

  const loadStatus = useCallback(() => {
    fetch('/api/admin/status', { credentials: 'include' })
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  if (!status) return <div className="admin-page"><div className="admin-loading">Loading...</div></div>;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>Admin</h2>
        <button onClick={onClose}>Close</button>
      </div>

      <div className="admin-sections">
        <div className="admin-section">
          <h3>Garmin inReach</h3>
          <div className="admin-info">
            <div className="admin-row">
              <span>Status</span>
              <span className={status.garmin.configured ? 'status-ok' : 'status-off'}>
                {status.garmin.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            {status.garmin.mapshareId && (
              <div className="admin-row">
                <span>MapShare ID</span>
                <span>{status.garmin.mapshareId}</span>
              </div>
            )}
            <div className="admin-row">
              <span>Total points</span>
              <span>{status.garmin.totalPoints}</span>
            </div>
            <div className="admin-row">
              <span>Last point</span>
              <span>{status.garmin.lastPointTime ? new Date(status.garmin.lastPointTime).toLocaleString() : 'None'}</span>
            </div>
            <div className="admin-row">
              <span>Auto-poll interval</span>
              <span>{status.garmin.pollIntervalMin} min</span>
            </div>
          </div>
          <button className="primary" onClick={async () => { setSyncingGarmin(true); await onGarminSync(); setSyncingGarmin(false); loadStatus(); }} disabled={syncingGarmin}>
            {syncingGarmin ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        <div className="admin-section">
          <h3>Strava</h3>
          <div className="admin-info">
            <div className="admin-row">
              <span>Status</span>
              <span className={status.strava.connected ? 'status-ok' : 'status-off'}>
                {status.strava.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            {status.strava.athleteId && (
              <div className="admin-row">
                <span>Athlete ID</span>
                <span>{status.strava.athleteId}</span>
              </div>
            )}
            <div className="admin-row">
              <span>Total activities</span>
              <span>{status.strava.totalActivities}</span>
            </div>
            <div className="admin-row">
              <span>Last activity</span>
              <span>
                {status.strava.lastActivityDate
                  ? `${status.strava.lastActivityName} (${new Date(status.strava.lastActivityDate).toLocaleDateString()})`
                  : 'None'}
              </span>
            </div>
            <div className="admin-row">
              <span>Auto-sync</span>
              <span>Every 24h</span>
            </div>
          </div>
          {status.strava.connected ? (
            <button className="primary" onClick={async () => { setSyncingStrava(true); await onStravaSync(); setSyncingStrava(false); loadStatus(); }} disabled={syncingStrava}>
              {syncingStrava ? 'Syncing...' : 'Sync Now'}
            </button>
          ) : (
            <button className="primary" onClick={onStravaConnect}>
              Connect Strava
            </button>
          )}
        </div>

        <div className="admin-section">
          <h3>Sync Logs</h3>
          <div className="admin-logs">
            {status.logs.length === 0 ? (
              <div className="admin-log-empty">No logs yet</div>
            ) : (
              status.logs.map((log, i) => (
                <div key={i} className="admin-log">
                  <span className={`log-source log-${log.source}`}>{log.source}</span>
                  <span className="log-time">{new Date(log.time).toLocaleString()}</span>
                  <span className="log-message">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
