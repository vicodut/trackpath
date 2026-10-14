import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import type { TrackingPoint, StravaActivity } from '../../types';
import type { Poll } from '../../api/polls';
import type { Cheer } from '../../api/cheers';
import type { SyncPeriod } from '../../api/syncPeriods';
import { TAGS, TAG_EMOJIS } from '../../lib/constants';
import { fetchSyncPeriods } from '../../api/syncPeriods';
import { filterHikeActivities, sumHikeDistanceKm } from '../../lib/stravaHike';
import { AddPointForm } from '../AddPointForm';
import { PointCard } from '../PointCard';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useUnit } from '../../hooks/useUnit';
import styles from './Sidebar.module.css';

const GOAL_KM = 1500;

const TAG_FILTERS = [
  { key: 'inreach', label: 'INREACH', emoji: '📡' },
  { key: 'resupply', label: 'RESUPPLY', emoji: '🛒' },
  { key: 'poop', label: 'POOP', emoji: '💩' },
  { key: 'hostel', label: 'HOSTEL', emoji: '🏠' },
  { key: 'camp', label: 'CAMP', emoji: '⛺' },
  { key: 'shelter', label: 'SHELTER', emoji: '🛖' },
  { key: 'water', label: 'WATER', emoji: '💧' },
  { key: 'viewpoint', label: 'VIEW', emoji: '👀' },
] as const;

interface SidebarProps {
  visible?: boolean;
  points: TrackingPoint[];
  loading?: boolean;
  totalDistanceKm: number;
  totalElevationGain: number;
  stravaActivities: StravaActivity[];
  onSelectPoint: (point: TrackingPoint) => void;
  onDeletePoint: (id: number) => void;
  onAddPoint: (data: { latitude: number; longitude: number; altitude?: number | null; message?: string | null; tag?: string | null }) => Promise<boolean>;
  onFormToggle: (open: boolean) => void;
  onAddSuccess?: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  isAdmin: boolean;
  forceFormOpen?: boolean;
  polls?: Poll[];
  onVote?: (pollId: number, optionId: number) => void;
  onCreatePoll?: (question: string, options: string[]) => void;
  onClosePoll?: (pollId: number) => void;
  onDeletePoll?: (pollId: number) => void;
  cheers?: Cheer[];
  onSubmitCheer?: (name: string, message: string, isPublic: boolean) => Promise<boolean>;
  onDeleteCheer?: (id: number) => void;
  onOpenCheers?: () => void;
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ padding: '10px 12px', borderBottom: 'var(--ghost-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ height: 10, width: '55%' }} />
          <div className="skeleton" style={{ height: 8, width: '35%' }} />
        </div>
      ))}
    </>
  );
}

function TrailProgress({ trailProgressKm }: { trailProgressKm: number }) {
  const pct = Math.min((trailProgressKm / GOAL_KM) * 100, 100);
  return (
    <div className={styles.trailProgress}>
      <div className={styles.trailProgressHeader}>
        <span className={styles.trailProgressLabel}>GOAL</span>
        <span className={styles.trailProgressValue}>{trailProgressKm.toFixed(0)} / {GOAL_KM} km</span>
      </div>
      <div className={styles.trailProgressBar}>
        <div className={styles.trailProgressFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.trailProgressPct}>{pct.toFixed(1)}%</div>
    </div>
  );
}

function PollsSection({
  polls, isAdmin, onVote, onCreatePoll, onClosePoll, onDeletePoll,
}: {
  polls: Poll[];
  isAdmin: boolean;
  onVote?: (pollId: number, optionId: number) => void;
  onCreatePoll?: (question: string, options: string[]) => void;
  onClosePoll?: (pollId: number) => void;
  onDeletePoll?: (pollId: number) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const canSubmit = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  const handleCreate = () => {
    if (!canSubmit) return;
    const trimmedOpts = options.map((o) => o.trim()).filter(Boolean);
    onCreatePoll?.(question.trim(), trimmedOpts);
    setQuestion('');
    setOptions(['', '']);
    setShowForm(false);
  };

  const setOption = (i: number, val: string) =>
    { setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o))); };

  if (polls.length === 0 && !isAdmin) return null;

  return (
    <div className={styles.pollsSection}>
      <div className={styles.pollHeader}>
        <span className={styles.pollHeaderLabel}>POLL</span>
        {isAdmin && (
          <button className={styles.pollNewBtn} onClick={() => { setShowForm((s) => !s); }}>
            {showForm ? '✕' : '+ New'}
          </button>
        )}
      </div>

      {showForm && (
        <div className={styles.pollForm}>
          <input
            className={styles.pollFormInput}
            placeholder="Question…"
            value={question}
            onChange={(e) => { setQuestion(e.target.value); }}
          />
          <div className={styles.pollFormOptions}>
            {options.map((o, i) => (
              <input
                key={i}
                className={styles.pollFormInput}
                placeholder={`Option ${i + 1}`}
                value={o}
                onChange={(e) => { setOption(i, e.target.value); }}
              />
            ))}
          </div>
          {options.length < 6 && (
            <button
              className={styles.pollAddOptionBtn}
              onClick={() => { setOptions((prev) => [...prev, '']); }}
            >
              + add option
            </button>
          )}
          <div className={styles.pollFormActions}>
            <button
              className={`${styles.pollSubmitBtn} ${canSubmit ? styles.pollSubmitReady : ''}`}
              onClick={handleCreate}
              disabled={!canSubmit}
            >
              Create
            </button>
            <button className={styles.pollCancelBtn} onClick={() => { setShowForm(false); }}>Cancel</button>
          </div>
        </div>
      )}

      {polls.map((poll) => {
        const voted = poll.votedOptionId != null;
        const showResults = voted || poll.closed;
        const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 1);

        return (
          <div key={poll.id} className={`${styles.pollItem} ${poll.closed ? styles.pollClosed : ''}`}>
            <p className={styles.pollQuestion}>{poll.question}</p>
            {!showResults ? (
              <div className={styles.pollOptions}>
                {poll.options.map((opt) => (
                  <button
                    key={opt.id}
                    className={styles.pollOptionBtn}
                    onClick={() => onVote?.(poll.id, opt.id)}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.pollResults}>
                {poll.options.map((opt) => {
                  const pct = poll.totalVotes > 0
                    ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                    : 0;
                  const isVoted = opt.id === poll.votedOptionId;
                  return (
                    <div key={opt.id} className={`${styles.pollResultRow} ${isVoted ? styles.pollResultVoted : ''}`}>
                      <span className={styles.pollResultLabel}>{opt.text}</span>
                      <div className={styles.pollBar}>
                        <div
                          className={styles.pollBarFill}
                          style={{ width: `${(opt.voteCount / maxVotes) * 100}%` }}
                        />
                      </div>
                      <span className={styles.pollPct}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className={styles.pollMeta}>
              <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
              {poll.closed && <span className={styles.pollClosedBadge}>CLOSED</span>}
              {isAdmin && !poll.closed && (
                <button className={styles.pollCloseBtn} onClick={() => onClosePoll?.(poll.id)}>
                  Close
                </button>
              )}
              {isAdmin && (
                <button className={styles.pollDeleteBtn} onClick={() => onDeletePoll?.(poll.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const CHEER_NAME_KEY = 'trackpath:cheer-name';

function CheersSection({ cheers, isAdmin, onSubmit, onDelete, onSeeAll }: {
  cheers: Cheer[];
  isAdmin: boolean;
  onSubmit?: (name: string, message: string, isPublic: boolean) => Promise<boolean>;
  onDelete?: (id: number) => void;
  onSeeAll?: () => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem(CHEER_NAME_KEY) ?? '');
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const todayCheers = cheers.filter(c => c.createdAt.slice(0, 10) === today);

  const handleNameChange = (val: string) => {
    setName(val);
    try { localStorage.setItem(CHEER_NAME_KEY, val); } catch { /* ignore */ }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !message.trim()) return;
    setSending(true);
    const ok = await onSubmit?.(name.trim(), message.trim(), isPublic);
    setSending(false);
    if (ok) { setMessage(''); setSent(true); setTimeout(() => { setSent(false); }, 3000); }
  };

  return (
    <div className={styles.cheersSection}>
      <div className={styles.pollHeader}>
        <span className={styles.pollHeaderLabel}>🥾 CHEERS</span>
      </div>

      <div className={styles.cheersForm}>
        <input
          className={styles.pollFormInput}
          placeholder="Your name"
          value={name}
          onChange={e => { handleNameChange(e.target.value); }}
          maxLength={50}
        />
        <textarea
          className={styles.cheersTextarea}
          placeholder="Send Vico some motivation! 💪"
          value={message}
          onChange={e => { setMessage(e.target.value); }}
          rows={2}
          maxLength={280}
        />
        <label className={styles.cheersPublicLabel}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => { setIsPublic(e.target.checked); }}
          />
          Make it public
        </label>
        <button
          className={styles.pollVoteBtn}
          onClick={handleSubmit}
          disabled={!name.trim() || !message.trim() || sending}
        >
          {sent ? '🎉 Sent!' : sending ? 'Sending…' : 'Send Cheers →'}
        </button>
      </div>

      {todayCheers.length > 0 && (
        <div className={styles.cheersList}>
          {todayCheers.map(c => (
            <div key={c.id} className={styles.cheerItem}>
              <div className={styles.cheerHeader}>
                <span className={styles.cheerName}>{c.name}</span>
                {isAdmin && !c.isPublic && <span className={styles.cheerPrivate}>🔒 private</span>}
                <span className={styles.cheerTime}>
                  {new Date(c.createdAt).toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {isAdmin && (
                  <button className={styles.pollDeleteBtn} onClick={() => onDelete?.(c.id)}>✕</button>
                )}
              </div>
              <p className={styles.cheerMessage}>"{c.message}"</p>
            </div>
          ))}
        </div>
      )}
      {cheers.length > todayCheers.length && (
        <button className={styles.pollNewBtn} style={{ marginTop: 6, alignSelf: 'flex-end' }} onClick={onSeeAll}>
          See all ({cheers.length}) →
        </button>
      )}
    </div>
  );
}

function SidebarContent({
  points, loading, totalDistanceKm, totalElevationGain, stravaActivities,
  onSelectPoint, onDeletePoint, onAddPoint, onFormToggle, onAddSuccess, pickedCoords, isAdmin, forceFormOpen,
  polls, onVote, onCreatePoll, onClosePoll, onDeletePoll,
  cheers, onSubmitCheer, onDeleteCheer, onOpenCheers,
}: SidebarProps) {
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [periods, setPeriods] = useState<SyncPeriod[]>([]);
  const { fmtDist } = useUnit();

  useEffect(() => {
    fetchSyncPeriods().then(setPeriods).catch(() => { /* keep the empty fallback */ });
  }, []);

  const toggleFilter = (key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // GOAL progress is Strava's cumulative hiking distance — matches
  // LocationBanner's + StatsPage's calculation so all three never disagree.
  const hikeActivities = useMemo(() => filterHikeActivities(stravaActivities, periods), [stravaActivities, periods]);
  const stravaTrailKm = useMemo(() => sumHikeDistanceKm(hikeActivities), [hikeActivities]);

  const stravaElevation = useMemo(() =>
    stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
  [stravaActivities]);

  const totalElev = totalElevationGain + stravaElevation;

  const filteredPoints = useMemo(() => {
    if (activeFilters.size === 0) return points;
    return points.filter(pt => {
      for (const f of activeFilters) {
        if (f === 'inreach' && pt.garminId && !pt.garminId.startsWith('manual-')) return true;
        if (f !== 'inreach' && pt.eventType === f) return true;
      }
      return false;
    });
  }, [points, activeFilters]);

  // Group points by day (newest day first)
  const groupedByDay = useMemo(() => {
    const map = new Map<string, TrackingPoint[]>();
    for (const pt of [...filteredPoints].reverse()) {
      const key = new Date(pt.timestamp).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pt);
    }
    return [...map.entries()];
  }, [filteredPoints]);

  return (
    <>
      {(polls && polls.length > 0 || isAdmin) && (
        <PollsSection
          polls={polls ?? []}
          isAdmin={isAdmin}
          onVote={onVote}
          onCreatePoll={onCreatePoll}
          onClosePoll={onClosePoll}
          onDeletePoll={onDeletePoll}
        />
      )}
      <CheersSection
        cheers={cheers ?? []}
        isAdmin={isAdmin}
        onSubmit={onSubmitCheer}
        onDelete={onDeleteCheer}
        onSeeAll={onOpenCheers}
      />
      {stravaTrailKm > 0 && (
        <TrailProgress trailProgressKm={stravaTrailKm} />
      )}
      <div className={styles.sidebarHeader}>
        <h2>TRAIL_LOG</h2>
        <div className={styles.stats}>
          <span>PTS: <strong>{filteredPoints.length}</strong></span>
          <span>DIST: <strong>{fmtDist(totalDistanceKm)}</strong></span>
          <span>ELEV: <strong>{Math.round(totalElev)}</strong> m</span>
        </div>
      </div>
      <div className={styles.sidebarHeaderActions}>
        <a
          className={styles.gpxDownload}
          href="/api/export.gpx"
          download="trackpath.gpx"
        >
          ↓ GPX
        </a>
      </div>
      <div className={styles.tagFilters}>
        {TAG_FILTERS.map(({ key, emoji }) => (
          <button
            key={key}
            className={`${styles.tagFilterBtn} ${activeFilters.has(key) ? styles.active : ''}`}
            onClick={() => { toggleFilter(key); }}
          >
            {emoji}
          </button>
        ))}
      </div>
      {isAdmin && (
        <AddPointForm
          onSubmit={onAddPoint}
          onFormToggle={onFormToggle}
          onSuccess={onAddSuccess}
          pickedCoords={pickedCoords}
          forceOpen={forceFormOpen}
        />
      )}
      <div className={styles.pointsList}>
        {loading ? (
          <SkeletonCards />
        ) : (
          groupedByDay.map(([day, dayPoints]) => (
            <div key={day} className={styles.dayGroup}>
              <div className={styles.dayHeader}>
                <span className={styles.dayLabel}>{day}</span>
                <span className={styles.dayStat}>{dayPoints.length} pts</span>
              </div>
              {dayPoints.map(pt => (
                <PointCard
                  key={pt.id}
                  point={pt}
                  onSelect={onSelectPoint}
                  onDelete={isAdmin ? onDeletePoint : undefined}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function MobileAddDrawer({ snap, setSnap, onAddPoint, onAddSuccess, onFormToggle, pickedCoords }: {
  snap: number | string | null;
  setSnap: (s: number | string | null) => void;
  onAddPoint: SidebarProps['onAddPoint'];
  onAddSuccess?: () => void;
  onFormToggle: (open: boolean) => void;
  pickedCoords: { lat: number; lng: number } | null;
}) {
  const [tag, setTag] = useState('');
  const [msg, setMsg] = useState('');

  const handleSubmit = async () => {
    if (!pickedCoords) return;
    const ok = await onAddPoint({
      latitude: pickedCoords.lat,
      longitude: pickedCoords.lng,
      message: msg.trim() || null,
      tag: tag || null,
    });
    if (ok) {
      setTag('');
      setMsg('');
      onFormToggle(false);
      onAddSuccess?.();
    }
  };

  const handleClose = () => {
    setTag('');
    setMsg('');
    onFormToggle(false);
    onAddSuccess?.();
  };

  return (
    <Drawer.Root
      open
      onOpenChange={(open) => { if (!open) handleClose(); }}
      modal={false}
      snapPoints={[0.45, 0.85, 1]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content className={styles.drawerContent}>
          <div className={styles.drawerHandle}>
            <div className={styles.drawerHandleBar} />
          </div>
          <div className={styles.mobileAddForm}>
            <div className={styles.mobileAddHeader}>
              <span className={styles.mobileAddTitle}>ADD POINT</span>
              {pickedCoords && (
                <span className={styles.mobileAddCoords}>
                  {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                </span>
              )}
              <button className={styles.mobileAddClose} onClick={handleClose}>X</button>
            </div>
            {!pickedCoords && (
              <p className={`${styles.pickHint} ${styles.active}`}>TAP MAP TO SET COORDINATES</p>
            )}
            <div className={styles.addFormTagGrid}>
              {TAGS.map((t) => (
                <button
                  key={t}
                  className={`${styles.addFormTagBtn} ${tag === t ? styles.active : ''}`}
                  onClick={() => { setTag(tag === t ? '' : t); }}
                >
                  <span className={styles.addFormTagEmoji}>{TAG_EMOJIS[t]}</span>
                  <span className={styles.addFormTagLabel}>{t}</span>
                </button>
              ))}
            </div>
            <textarea
              className={styles.mobileAddMessage}
              placeholder="Message (optional)"
              value={msg}
              onChange={(e) => { setMsg(e.target.value); }}
              rows={2}
            />
            <button
              className={styles.mobileAddSubmit}
              onClick={handleSubmit}
              disabled={!pickedCoords}
            >
              SUBMIT
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Sidebar(props: SidebarProps) {
  const isMobile = useIsMobile();
  const [snap, setSnap] = useState<number | string | null>(0.85);

  useEffect(() => {
    if (props.forceFormOpen && isMobile) setSnap(0.85);
  }, [props.forceFormOpen, isMobile]);

  if (!isMobile) {
    return (
      <div className={`${styles.sidebar} ${props.visible === false ? styles.sidebarHidden : ''}`}>
        <SidebarContent {...props} />
      </div>
    );
  }

  if (!props.forceFormOpen || !props.isAdmin) return null;

  return (
    <MobileAddDrawer
      snap={snap}
      setSnap={setSnap}
      onAddPoint={props.onAddPoint}
      onAddSuccess={props.onAddSuccess}
      onFormToggle={props.onFormToggle}
      pickedCoords={props.pickedCoords}
    />
  );
}
