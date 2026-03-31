import { useEffect, useState } from 'react';
import type { StravaActivity } from '../../types';
import styles from './Blog.module.css';

import { colors } from '../../theme';

const GHOST_URL = 'https://ghost-production-1882.up.railway.app';
const GHOST_KEY = '0d6476834a0eeaa76e910081c9';

interface Post {
  id: string;
  title: string;
  slug: string;
  feature_image: string | null;
  excerpt: string;
  published_at: string;
  reading_time: number;
}

type TimelineEntry =
  | { type: 'post'; date: string; data: Post }
  | { type: 'strava'; date: string; data: StravaActivity };

interface BlogListProps {
  onSelectPost: (slug: string) => void;
  onClose: () => void;
}

function dayNumber(startDate: string, entryDate: string): number {
  const start = new Date(startDate);
  const entry = new Date(entryDate);
  return Math.max(1, Math.floor((entry.getTime() - start.getTime()) / 86400000) + 1);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

function MiniTrace({ coordsJson }: { coordsJson: string | null }) {
  if (!coordsJson) return null;
  let coords: [number, number][];
  try {
    coords = JSON.parse(coordsJson) as [number, number][];
  } catch {
    return null;
  }
  if (coords.length < 2) return null;

  // Sample for performance
  const step = Math.max(1, Math.floor(coords.length / 200));
  const sampled = coords.filter((_, i) => i % step === 0);

  const lats = sampled.map(c => c[0]);
  const lons = sampled.map(c => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const rangeL = maxLat - minLat || 0.001;
  const rangeN = maxLon - minLon || 0.001;

  const w = 400;
  const h = 100;
  const pad = 6;
  const pw = w - pad * 2;
  const ph = h - pad * 2;

  const pathD = sampled.map((c, i) => {
    const x = pad + ((c[1] - minLon) / rangeN) * pw;
    const y = pad + (1 - (c[0] - minLat) / rangeL) * ph;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={styles.miniTrace}>
      <path d={pathD} fill="none" stroke={colors.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Start dot */}
      <circle cx={pad + ((sampled[0][1] - minLon) / rangeN) * pw} cy={pad + (1 - (sampled[0][0] - minLat) / rangeL) * ph} r="3" fill={colors.primary} />
      {/* End dot */}
      <circle cx={pad + ((sampled[sampled.length - 1][1] - minLon) / rangeN) * pw} cy={pad + (1 - (sampled[sampled.length - 1][0] - minLat) / rangeL) * ph} r="3" fill={colors.secondary} />
    </svg>
  );
}

export function BlogList({ onSelectPost, onClose }: BlogListProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${GHOST_URL}/ghost/api/content/posts/?key=${GHOST_KEY}&fields=id,title,slug,feature_image,excerpt,published_at,reading_time&order=published_at%20asc`)
        .then(r => r.json())
        .then((data: { posts: Post[] }) => data.posts),
      fetch('/api/strava/activities')
        .then(r => r.json())
        .then((data: StravaActivity[]) => data)
        .catch(() => [] as StravaActivity[]),
    ]).then(([fetchedPosts, fetchedActivities]) => {
      setPosts(fetchedPosts);
      setActivities(fetchedActivities);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Merge into timeline, newest first
  const timeline: TimelineEntry[] = [];
  for (const p of posts) {
    timeline.push({ type: 'post', date: p.published_at, data: p });
  }
  for (const a of activities) {
    if (a.startDate) {
      timeline.push({ type: 'strava', date: a.startDate, data: a });
    }
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const startDate = timeline.length > 0
    ? timeline[timeline.length - 1].date
    : '';

  return (
    <div className={styles.blogPage}>
      <div className={styles.blogHeader}>
        <h2>TRAIL_JOURNAL</h2>
        <button onClick={onClose}>CLOSE</button>
      </div>
      <div className={styles.blogContent}>
        {loading && <div className={styles.blogLoading}>Loading...</div>}
        {!loading && timeline.length === 0 && (
          <div className={styles.blogEmpty}>No entries yet.</div>
        )}
        {!loading && timeline.length > 0 && (
          <div className={styles.journal}>
            {timeline.map((entry, idx) => {
              const date = new Date(entry.date);
              const day = dayNumber(startDate, entry.date);
              const isLatest = idx === 0;

              if (entry.type === 'strava') {
                const a = entry.data;
                const dist = a.distance ? (a.distance / 1000).toFixed(1) : '?';
                const elev = a.elevationGain ? `+${Math.round(a.elevationGain)}m` : '';
                const duration = a.movingTime ? formatDuration(a.movingTime) : '';

                return (
                  <div
                    key={`strava-${a.id}`}
                    className={`${styles.entry} ${styles.entryStrava} ${isLatest ? styles.entryLatest : ''}`}
                    onClick={() => window.open(`https://www.strava.com/activities/${String(a.stravaId)}`, '_blank')}
                  >
                    <div className={styles.entryMargin}>
                      <span className={styles.entryDay}>DAY {day}</span>
                      <span className={styles.entryDate}>
                        {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <div className={`${styles.entryDot} ${styles.entryDotStrava}`} />
                    </div>
                    <div className={styles.entryContent}>
                      <MiniTrace coordsJson={a.coords} />
                      <div className={styles.stravaHeader}>
                        <span className={styles.stravaIcon}>🏃</span>
                        <h3 className={styles.entryTitle}>{a.name ?? 'Activity'}</h3>
                      </div>
                      <div className={styles.stravaStats}>
                        <span>{dist} km</span>
                        {elev && <span>{elev}</span>}
                        {duration && <span>{duration}</span>}
                        {a.type && <span>{a.type}</span>}
                      </div>
                    </div>
                  </div>
                );
              }

              const post = entry.data;
              return (
                <div
                  key={post.id}
                  className={`${styles.entry} ${isLatest ? styles.entryLatest : ''}`}
                  onClick={() => onSelectPost(post.slug)}
                >
                  <div className={styles.entryMargin}>
                    <span className={styles.entryDay}>DAY {day}</span>
                    <span className={styles.entryDate}>
                      {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <div className={styles.entryDot} />
                  </div>
                  <div className={styles.entryContent}>
                    <h3 className={styles.entryTitle}>{post.title}</h3>
                    <p className={styles.entryExcerpt}>{post.excerpt}</p>
                    {post.feature_image && (
                      <img
                        className={styles.entryImage}
                        src={post.feature_image}
                        alt={post.title}
                      />
                    )}
                    <div className={styles.entryFooter}>
                      {post.reading_time > 0 && <span>{post.reading_time} min read</span>}
                      <span>READ MORE</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
