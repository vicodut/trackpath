import { useState, useEffect, useCallback } from 'react';
import type { Poll, PollSuggestion } from '../../api/polls';
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
  polls: Poll[];
  onCreatePoll: (question: string, options: string[]) => void;
  onClosePoll: (pollId: number) => void;
  onDeletePoll: (pollId: number) => void;
  suggestions: PollSuggestion[];
  onLoadSuggestions: () => Promise<void>;
  onAcceptSuggestion: (id: number) => Promise<void>;
  onRejectSuggestion: (id: number) => Promise<void>;
}

export function AdminPage({ onClose, onStravaConnect, onStravaSync, onGarminSync, syncing: _syncing, polls, onCreatePoll, onClosePoll, onDeletePoll, suggestions, onLoadSuggestions, onAcceptSuggestion, onRejectSuggestion }: AdminPageProps) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [syncingGarmin, setSyncingGarmin] = useState(false);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const canSubmitPoll = pollQuestion.trim().length > 0 && pollOptions.filter(o => o.trim()).length >= 2;

  const loadStatus = useCallback(() => {
    fetch('/api/admin/status', { credentials: 'include' })
      .then(r => r.json())
      .then(setStatus)
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadStatus();
    void onLoadSuggestions();
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [loadStatus, onLoadSuggestions]);

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
          <h3>Polls</h3>
          <div className={styles.adminInfo}>
            {polls.length === 0 && (
              <div className={styles.adminLogEmpty}>No polls yet</div>
            )}
            {polls.map(poll => (
              <div key={poll.id} className={styles.pollRow}>
                <div className={styles.pollRowMeta}>
                  <span className={styles.pollRowQuestion}>{poll.question}</span>
                  <span className={`${styles.pollRowStatus} ${poll.closed ? styles.pollRowClosed : styles.pollRowOpen}`}>
                    {poll.closed ? 'Closed' : 'Open'}
                  </span>
                  <span className={styles.pollRowVotes}>{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
                </div>
                <div className={styles.pollRowOptions}>
                  {poll.options.map(opt => {
                    const pct = poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                    return (
                      <div key={opt.id} className={styles.pollOptionRow}>
                        <span className={styles.pollOptionText}>{opt.text}</span>
                        <div className={styles.pollOptionBar}>
                          <div className={styles.pollOptionBarFill} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.pollOptionPct}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.pollRowActions}>
                  {!poll.closed && (
                    <button className={styles.pollActionBtn} onClick={() => onClosePoll(poll.id)}>Close</button>
                  )}
                  <button className={`${styles.pollActionBtn} ${styles.pollDeleteBtn}`} onClick={() => onDeletePoll(poll.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.pollCreateForm}>
            <input
              className={styles.pollCreateInput}
              placeholder="New poll question…"
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
            />
            <div className={styles.pollCreateOptions}>
              {pollOptions.map((o, i) => (
                <input
                  key={i}
                  className={styles.pollCreateInput}
                  placeholder={`Option ${i + 1}`}
                  value={o}
                  onChange={e => setPollOptions(prev => prev.map((p, idx) => idx === i ? e.target.value : p))}
                />
              ))}
            </div>
            {pollOptions.length < 6 && (
              <button className={styles.pollAddOption} onClick={() => setPollOptions(p => [...p, ''])}>
                + add option
              </button>
            )}
            <button
              className={`primary ${!canSubmitPoll ? styles.pollSubmitDisabled : ''}`}
              disabled={!canSubmitPoll}
              onClick={() => {
                if (!canSubmitPoll) return;
                onCreatePoll(pollQuestion.trim(), pollOptions.filter(o => o.trim()));
                setPollQuestion('');
                setPollOptions(['', '']);
              }}
            >
              Create Poll
            </button>
          </div>
        </div>

        <div className={styles.adminSection}>
          <h3>Poll Suggestions</h3>
          {suggestions.length === 0 ? (
            <div className={styles.adminLogEmpty}>No suggestions yet</div>
          ) : (
            <div className={styles.adminInfo}>
              {suggestions.map((s) => (
                <div key={s.id} className={styles.suggestionRow}>
                  <div className={styles.suggestionMeta}>
                    <span className={styles.suggestionQuestion}>{s.question}</span>
                    <span className={styles.suggestionDate}>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <ul className={styles.suggestionOptions}>
                    {s.options.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                  <div className={styles.pollRowActions}>
                    <button className={styles.pollActionBtn} onClick={() => void onAcceptSuggestion(s.id)}>
                      ✓ Accept
                    </button>
                    <button className={`${styles.pollActionBtn} ${styles.pollDeleteBtn}`} onClick={() => void onRejectSuggestion(s.id)}>
                      ✕ Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
