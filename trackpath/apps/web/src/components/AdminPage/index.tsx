import { useState, useEffect, useCallback } from 'react';
import styles from './AdminPage.module.css';

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

export function AdminPage({ onClose, onStravaConnect, onStravaSync, onGarminSync, syncing: _syncing }: AdminPageProps) {
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

  if (!status) return <div className={styles.adminPage}><div className={styles.adminLoading}>Loading...</div></div>;

  return (
    <div className={styles.adminPage}>
      <div className={styles.adminHeader}>
        <h2>Admin</h2>
        <button onClick={onClose}>Close</button>
      </div>

      <div className={styles.adminSections}>
        <div className={styles.adminSection}>
          <h3>Garmin inReach</h3>
          <div className={styles.adminInfo}>
            <div className={styles.adminRow}>
              <span>Status</span>
              <span className={status.garmin.configured ? styles.statusOk : styles.statusOff}>
                {status.garmin.configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
            {status.garmin.mapshareId && (
              <div className={styles.adminRow}>
                <span>MapShare ID</span>
                <span>{status.garmin.mapshareId}</span>
              </div>
            )}
            <div className={styles.adminRow}>
              <span>Total points</span>
              <span>{status.garmin.totalPoints}</span>
            </div>
            <div className={styles.adminRow}>
              <span>Last point</span>
              <span>{status.garmin.lastPointTime ? new Date(status.garmin.lastPointTime).toLocaleString() : 'None'}</span>
            </div>
            <div className={styles.adminRow}>
              <span>Auto-poll interval</span>
              <span>{status.garmin.pollIntervalMin} min</span>
            </div>
          </div>
          <button className="primary" onClick={async () => { setSyncingGarmin(true); await onGarminSync(); setSyncingGarmin(false); loadStatus(); }} disabled={syncingGarmin}>
            {syncingGarmin ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        <div className={styles.adminSection}>
          <h3>Strava</h3>
          <div className={styles.adminInfo}>
            <div className={styles.adminRow}>
              <span>Status</span>
              <span className={status.strava.connected ? styles.statusOk : styles.statusOff}>
                {status.strava.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            {status.strava.athleteId && (
              <div className={styles.adminRow}>
                <span>Athlete ID</span>
                <span>{status.strava.athleteId}</span>
              </div>
            )}
            <div className={styles.adminRow}>
              <span>Total activities</span>
              <span>{status.strava.totalActivities}</span>
            </div>
            <div className={styles.adminRow}>
              <span>Last activity</span>
              <span>
                {status.strava.lastActivityDate
                  ? `${status.strava.lastActivityName} (${new Date(status.strava.lastActivityDate).toLocaleDateString()})`
                  : 'None'}
              </span>
            </div>
            <div className={styles.adminRow}>
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

        <div className={styles.adminSection}>
          <h3>Sync Logs</h3>
          <div className={styles.adminLogs}>
            {status.logs.length === 0 ? (
              <div className={styles.adminLogEmpty}>No logs yet</div>
            ) : (
              status.logs.map((log, i) => (
                <div key={i} className={styles.adminLog}>
                  <span className={`${styles.logSource} ${log.source === 'garmin' ? styles.logGarmin : styles.logStrava}`}>{log.source}</span>
                  <span className={styles.logTime}>{new Date(log.time).toLocaleString()}</span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
