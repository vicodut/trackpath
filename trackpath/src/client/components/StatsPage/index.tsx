import { useEffect, useMemo, useState } from 'react';
import type { TrackingPoint, StravaActivity } from '../../types';
import { ICONIC_SUMMITS } from '../../data/iconic-summits';
import { haversine } from '../../lib/geo';
import styles from './StatsPage.module.css';

interface StatsPageProps {
  points: TrackingPoint[];
  stravaActivities: StravaActivity[];
  totalDistanceKm: number;
  totalElevationGain: number;
  isAdmin: boolean;
  onClose: () => void;
}

const AT_TOTAL_KM = 1500;
const BEER_CAL = 153; // regular beer 12 fl oz, ~5% alc
const BEER_CARBS = 12.6;
const BEER_ALCOHOL_G = 13.8;
const CAL_PER_KM = 90; // approx cal burned hiking with pack on AT
const ELEV_CHART_HEIGHT = 280;
const ELEV_CHART_PADDING = { top: 20, right: 16, bottom: 36, left: 50 };
const HIKE_START = '2026-04-15';
const HIKE_END = '2026-07-13';

function buildDailyKm(points: TrackingPoint[], stravaActivities: StravaActivity[]): Record<string, number> {
  const dailyKm: Record<string, number> = {};

  // Sort points by timestamp
  const sorted = [...points].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compute distance between consecutive points, assign to the day of the second point
  for (let i = 1; i < sorted.length; i++) {
    const dist = haversine(
      sorted[i - 1].latitude, sorted[i - 1].longitude,
      sorted[i].latitude, sorted[i].longitude,
    );
    // Skip unrealistic jumps (> 100km between two consecutive points)
    if (dist > 100) continue;
    const day = sorted[i].timestamp.slice(0, 10);
    dailyKm[day] = (dailyKm[day] || 0) + dist;
  }

  // Add Strava activity distances
  for (const act of stravaActivities) {
    if (!act.startDate || !act.distance) continue;
    const day = act.startDate.slice(0, 10);
    dailyKm[day] = (dailyKm[day] || 0) + act.distance / 1000;
  }

  return dailyKm;
}

// Monday=0 .. Sunday=6
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function getFixedWeeksGrid(dailyKm: Record<string, number>) {
  const start = new Date(HIKE_START + 'T00:00:00');
  const end = new Date(HIKE_END + 'T00:00:00');

  // Align start to Monday
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - mondayIndex(gridStart));

  // Align end to Sunday
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - mondayIndex(gridEnd)));

  const weeks: ({ date: string; km: number; row: number } | null)[][] = [];
  const months: { label: string; weekIndex: number }[] = [];
  let currentWeek: typeof weeks[0] = [];
  let lastMonth = -1;

  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const row = mondayIndex(cursor); // 0=Mon, 6=Sun
    const inRange = cursor >= start && cursor <= end;

    currentWeek.push(inRange ? { date: dateStr, km: dailyKm[dateStr] || 0, row } : null);

    if (inRange && cursor.getMonth() !== lastMonth) {
      lastMonth = cursor.getMonth();
      months.push({
        label: cursor.toLocaleString('default', { month: 'short' }).toUpperCase(),
        weekIndex: weeks.length,
      });
    }

    // Sunday = end of week
    if (row === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return { weeks, months };
}

function intensityClass(km: number): string {
  if (km === 0) return styles.heatmapCell0;
  if (km < 10) return styles.heatmapCell1;
  if (km < 20) return styles.heatmapCell2;
  if (km < 30) return styles.heatmapCell3;
  return styles.heatmapCell4;
}

function buildElevationProfile(points: TrackingPoint[]) {
  const sorted = [...points]
    .filter(p => p.altitude != null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (sorted.length < 2) return [];

  let cumDist = 0;
  const profile: { dist: number; alt: number; date: string }[] = [
    { dist: 0, alt: sorted[0].altitude!, date: sorted[0].timestamp.slice(0, 10) },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const d = haversine(
      sorted[i - 1].latitude, sorted[i - 1].longitude,
      sorted[i].latitude, sorted[i].longitude,
    );
    if (d > 100) continue; // skip unrealistic jumps
    cumDist += d;
    profile.push({ dist: cumDist, alt: sorted[i].altitude!, date: sorted[i].timestamp.slice(0, 10) });
  }

  return profile;
}

function ElevationChart({ points }: { points: TrackingPoint[] }) {
  const profile = useMemo(() => buildElevationProfile(points), [points]);
  const [hovered, setHovered] = useState<{ alt: number; dist: number; x: number; y: number } | null>(null);

  if (profile.length < 2) return <div className={styles.statsEmpty}>NO_ALTITUDE_DATA</div>;

  const maxDist = profile[profile.length - 1].dist;
  const alts = profile.map(p => p.alt);
  const minAlt = Math.min(...alts);
  const maxAlt = Math.max(...alts);
  const altRange = maxAlt - minAlt || 1;

  const w = 800;
  const h = ELEV_CHART_HEIGHT;
  const { top, right, bottom, left } = ELEV_CHART_PADDING;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const toX = (dist: number) => left + (dist / maxDist) * plotW;
  const toY = (alt: number) => top + plotH - ((alt - minAlt) / altRange) * plotH;

  // Build SVG path
  const pathD = profile.map((p, i) => {
    const x = toX(p.dist);
    const y = toY(p.alt);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  // Filled area
  const areaD = pathD + ` L${toX(maxDist)},${top + plotH} L${left},${top + plotH} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minAlt + (altRange * i) / (yTicks - 1))
  );

  // X-axis ticks
  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    Math.round((maxDist * i) / (xTicks - 1))
  );

  return (
    <div className={styles.elevChartWrapper}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={styles.elevChartSvg}
        onMouseMove={(e) => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * w;
          const dist = ((mx - left) / plotW) * maxDist;
          // Find closest point
          let closest = profile[0];
          let minD = Infinity;
          for (const p of profile) {
            const d = Math.abs(p.dist - dist);
            if (d < minD) { minD = d; closest = p; }
          }
          setHovered({
            alt: closest.alt,
            dist: closest.dist,
            x: e.clientX,
            y: e.clientY,
          });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid lines */}
        {yTickValues.map(v => (
          <line key={`yg-${v}`} x1={left} x2={w - right} y1={toY(v)} y2={toY(v)} stroke="var(--outline-variant)" strokeWidth="0.5" opacity="0.3" />
        ))}
        {/* Filled area */}
        <path d={areaD} fill="url(#elevGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="2" />
        {/* Gradient def */}
        <defs>
          <linearGradient id="elevGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Y-axis labels */}
        {yTickValues.map(v => (
          <text key={`yl-${v}`} x={left - 6} y={toY(v) + 3} textAnchor="end" className={styles.elevChartLabel}>{v}m</text>
        ))}
        {/* X-axis labels */}
        {xTickValues.map(v => (
          <text key={`xl-${v}`} x={toX(v)} y={h - 6} textAnchor="middle" className={styles.elevChartLabel}>{v}km</text>
        ))}
        {/* Hover crosshair */}
        {hovered && (
          <>
            <line x1={toX(hovered.dist)} x2={toX(hovered.dist)} y1={top} y2={top + plotH} stroke="var(--secondary)" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
            <circle cx={toX(hovered.dist)} cy={toY(hovered.alt)} r="4" fill="var(--secondary)" />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className={styles.heatmapTooltip}
          style={{
            position: 'fixed',
            left: hovered.x,
            top: hovered.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <strong>{Math.round(hovered.alt)}m</strong>
          <span>{hovered.dist.toFixed(1)} km</span>
        </div>
      )}
    </div>
  );
}

interface TrailElevationPoint {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
}

const TRAIL_CHART_HEIGHT = 320;
const TRAIL_CHART_PADDING = { top: 24, right: 16, bottom: 56, left: 54 };

function TrailAltitudeProfile({ hikerDistanceKm, isAdmin }: { hikerDistanceKm: number; isAdmin: boolean }) {
  const [trailData, setTrailData] = useState<TrailElevationPoint[] | null>(null);
  const [hovered, setHovered] = useState<{ elevation: number; dist: number; x: number; y: number; summitName?: string } | null>(null);

  useEffect(() => {
    fetch('/at-trail-elevation.json')
      .then(res => res.json())
      .then(setTrailData)
      .catch(() => setTrailData(null));
  }, []);

  if (!trailData || trailData.length < 2) return null;

  const maxDist = trailData[trailData.length - 1].distanceKm;
  const elevations = trailData.map(p => p.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;

  const w = 800;
  const h = TRAIL_CHART_HEIGHT;
  const { top, right, bottom, left } = TRAIL_CHART_PADDING;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const toX = (dist: number) => left + (dist / maxDist) * plotW;
  const toY = (elev: number) => top + plotH - ((elev - minElev) / elevRange) * plotH;

  const pathD = trailData.map((p, i) => {
    const x = toX(p.distanceKm);
    const y = toY(p.elevation);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const areaD = pathD + ` L${toX(maxDist)},${top + plotH} L${left},${top + plotH} Z`;

  // Hiker progress line
  const hikerX = toX(Math.min(hikerDistanceKm, maxDist));

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minElev + (elevRange * i) / (yTicks - 1))
  );

  // X-axis ticks
  const xTicks = 6;
  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    Math.round((maxDist * i) / (xTicks - 1))
  );

  // Notable peaks/landmarks on the AT
  const landmarks = [
    { name: 'Springer Mtn', distKm: 0 },
    { name: 'Katahdin', distKm: maxDist },
  ];

  return (
    <div className={styles.elevChartWrapper}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className={styles.elevChartSvg}
        onMouseMove={(e) => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * w;
          const dist = ((mx - left) / plotW) * maxDist;
          let closest = trailData[0];
          let minD = Infinity;
          for (const p of trailData) {
            const d = Math.abs(p.distanceKm - dist);
            if (d < minD) { minD = d; closest = p; }
          }
          // Check if near an iconic summit
          const nearSummit = ICONIC_SUMMITS.find(s => Math.abs(s.distanceKm - closest.distanceKm) < maxDist * 0.015);
          setHovered({
            elevation: closest.elevation,
            dist: closest.distanceKm,
            x: e.clientX,
            y: e.clientY,
            summitName: nearSummit?.name,
          });
        }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Grid lines */}
        {yTickValues.map(v => (
          <line key={`yg-${v}`} x1={left} x2={w - right} y1={toY(v)} y2={toY(v)} stroke="var(--outline-variant)" strokeWidth="0.5" opacity="0.3" />
        ))}
        {/* Filled area — hiked portion */}
        <clipPath id="hikedClip">
          <rect x={left} y={0} width={hikerX - left} height={h} />
        </clipPath>
        <clipPath id="remainingClip">
          <rect x={hikerX} y={0} width={w - right - hikerX} height={h} />
        </clipPath>
        {/* Hiked area fill */}
        <path d={areaD} fill="url(#trailGradHiked)" clipPath="url(#hikedClip)" />
        {/* Remaining area fill */}
        <path d={areaD} fill="url(#trailGradRemaining)" clipPath="url(#remainingClip)" />
        {/* Hiked line */}
        <path d={pathD} fill="none" stroke="var(--secondary)" strokeWidth="2" clipPath="url(#hikedClip)" />
        {/* Remaining line */}
        <path d={pathD} fill="none" stroke="var(--outline-variant)" strokeWidth="1.5" clipPath="url(#remainingClip)" />
        {/* Goal line */}
        {AT_TOTAL_KM <= maxDist && (
          <>
            <line x1={toX(AT_TOTAL_KM)} x2={toX(AT_TOTAL_KM)} y1={top} y2={top + plotH} stroke="var(--error)" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7" />
            <text x={toX(AT_TOTAL_KM)} y={top - 4} textAnchor="middle" className={styles.elevChartLabel} fill="var(--error)" style={{ fontSize: '11px', fontWeight: 'bold' }}>GOAL {AT_TOTAL_KM}km</text>
          </>
        )}
        {/* Hiker position marker */}
        {hikerDistanceKm > 0 && (
          <>
            <line x1={hikerX} x2={hikerX} y1={top} y2={top + plotH} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4,3" />
            <text x={hikerX} y={top - 4} textAnchor="middle" className={styles.elevChartLabel} fill="var(--primary)" style={{ fontSize: '12px', fontWeight: 'bold' }}>{isAdmin ? 'YOU' : 'VICO'}</text>
          </>
        )}
        {/* Gradient defs */}
        <defs>
          <linearGradient id="trailGradHiked" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="trailGradRemaining" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--outline-variant)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--outline-variant)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Y-axis labels */}
        {yTickValues.map(v => (
          <text key={`yl-${v}`} x={left - 6} y={toY(v) + 3} textAnchor="end" className={styles.elevChartLabel}>{v}m</text>
        ))}
        {/* X-axis labels */}
        {xTickValues.map(v => (
          <text key={`xl-${v}`} x={toX(v)} y={top + plotH + 16} textAnchor="middle" className={styles.elevChartLabel}>{v}km</text>
        ))}
        {/* Landmark labels (below x-axis) */}
        {landmarks.map((lm, i) => (
          <text key={i} x={toX(lm.distKm)} y={top + plotH + 30} textAnchor={i === 0 ? 'start' : 'end'} className={styles.elevChartLabel} style={{ fontSize: '10px' }}>{lm.name}</text>
        ))}
        {/* Iconic summit markers */}
        {ICONIC_SUMMITS.map(s => {
          if (s.distanceKm > maxDist) return null;
          const sx = toX(s.distanceKm);
          const sy = toY(s.elevation);
          const active = hovered?.summitName === s.name;
          return (
            <g key={s.name} style={{ pointerEvents: 'none' }}>
              <line x1={sx} x2={sx} y1={sy} y2={top + plotH} stroke={active ? 'var(--secondary)' : 'var(--on-surface-variant)'} strokeWidth="0.5" opacity={active ? 0.6 : 0.3} strokeDasharray="2,3" />
              <polygon points={`${sx},${sy - 8} ${sx - 4},${sy} ${sx + 4},${sy}`} fill={active ? 'var(--secondary)' : 'var(--on-surface-variant)'} opacity={active ? 1 : 0.6} />
            </g>
          );
        })}
        {/* Hover crosshair */}
        {hovered && (
          <>
            <line x1={toX(hovered.dist)} x2={toX(hovered.dist)} y1={top} y2={top + plotH} stroke="var(--secondary)" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
            <circle cx={toX(hovered.dist)} cy={toY(hovered.elevation)} r="4" fill="var(--secondary)" />
          </>
        )}
      </svg>
      {hovered && (
        <div
          className={styles.heatmapTooltip}
          style={{
            position: 'fixed',
            left: hovered.x,
            top: hovered.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {hovered.summitName && <span style={{ color: 'var(--secondary)' }}>{hovered.summitName}</span>}
          <strong>{Math.round(hovered.elevation)}m</strong>
          <span>{hovered.dist.toFixed(1)} km</span>
        </div>
      )}
    </div>
  );
}

// ─── Road to Mordor ───────────────────────────────────────────────────────────

const AT_FULL_KM_MORDOR = 3524;

const MORDOR_MILESTONES = [
  { name: 'THE SHIRE',    place: 'Springer Mtn GA',    km: 0,                 sprite: 'shire'      },
  { name: 'WEATHERTOP',   place: 'Great Smokies NC',   km: 300,               sprite: 'weathertop' },
  { name: 'RIVENDELL',    place: 'Damascus VA',         km: 700,               sprite: 'rivendell'  },
  { name: 'MORIA',        place: 'Shenandoah VA',       km: 1100,              sprite: 'moria'      },
  { name: 'LOTHLÓRIEN',   place: "Harper's Ferry WV",  km: 1500,              sprite: 'lothlorien' },
  { name: 'ROHAN',        place: 'Delaware Water Gap',  km: 1900,              sprite: 'rohan'      },
  { name: 'ITHILIEN',     place: 'Vermont Green Mtns',  km: 2300,              sprite: 'ithilien'   },
  { name: 'DEAD MARSHES', place: 'Southern Maine',      km: 2700,              sprite: 'marshes'    },
  { name: 'CIRITH UNGOL', place: '100-Mile Wilderness', km: 3100,              sprite: 'cirith'     },
  { name: 'MOUNT DOOM',   place: 'Katahdin ME',         km: AT_FULL_KM_MORDOR, sprite: 'doom'       },
];

// Single-char color palette — shared across all sprites
const MP: Record<string, string> = {
  g: '#4a9a4a', G: '#2d6a2d',  // shire greens
  B: '#7c4a1e', b: '#3a1a08',  // browns
  W: '#e8dfc0', w: '#b0a890',  // rivendell ivory/stone
  D: '#3a3a3a', d: '#1a1a1a',  // dark stone (moria / cirith)
  E: '#ffaa00',                // torch amber
  S: '#888888', s: '#555555',  // weathertop stone
  L: '#f0c040', l: '#c8a030',  // lothlórien / rohan gold
  n: '#3a8a3a', N: '#1d5c1d',  // ithilien greens
  m: '#1a3020', F: '#88ff66',  // marshes + wisp
  O: '#ff6600', R: '#6a1100', r: '#3a0800', // doom fire/rock
  Y: '#ffd890', T: '#8b6914', C: '#4a6070', // frodo skin/hair/cloak
  // Sauron armor
  k: '#1e1e30', H: '#3a3a58', A: '#b8922a', Z: '#252535',
};

// 10 cols × N rows — '.' = transparent
const MORDOR_SPRITES: Record<string, string[]> = {
  shire: [
    '..ggggg...',
    '.gGGGGGg..',
    'gGGGbBbGGg',
    'GGGGBbBGGG',
    'GGGGGGGGGG',
  ],
  weathertop: [
    '....S.....',
    '...SSS....',
    '...S.S....',
    '..SsSsS...',
    '.sSSsSSs..',
    'SSSSSSSSSS',
  ],
  rivendell: [
    '....Ww....',
    '...WwwW...',
    '...WwwW...',
    '....WW....',
    '..WwwwwW..',
    '.WwwwwwwW.',
    '.wwwwwwww.',
  ],
  moria: [
    'DdDdDdDdDd',
    'D........D',
    'D..EEEE..D',
    'D..EEEE..D',
    'D........D',
    'DdDdDdDdDd',
  ],
  lothlorien: [
    '...LLLLL..',
    '..LLLLLLL.',
    '.LLLlLLLL.',
    '..LLLLLLL.',
    '....B.....',
    '....B.....',
    '...BBB....',
  ],
  rohan: [
    '..LLLLLL..',
    '.LLLLLLLL.',
    'LLLLLLLLLL',
    '.BBBBBBBB.',
    '.BB.BB.BB.',
    'BBBBBBBBBB',
  ],
  ithilien: [
    '...nnn....',
    '..nnnnn...',
    '.nNnNnNn..',
    '..nnnnn...',
    '....B.....',
    '....B.....',
    '...BBB....',
  ],
  marshes: [
    '..m..m..m.',
    '.m.m.m.m..',
    '..F....F..',
    '.m.m.m.m..',
    '..m..m..m.',
  ],
  cirith: [
    '....d.....',
    '...dDd....',
    '..DdDdD...',
    '.dDdDdDd..',
    'dDdDdDdDd.',
    'DDDDDDDDDD',
  ],
  doom: [
    '....OO....',
    '...OOOO...',
    '..OOOOOO..',
    '..RRRRRR..',
    '.RRRRRRRR.',
    'RRRRrRRRRR',
    'rrrrrrrrrr',
  ],
  frodo: [
    '...YYY....',
    '..YTTYY...',
    '..CCCCC...',
    '...CCC....',
    '..bC.Cb...',
  ],
};

const PS = 4; // pixel size

function MordorSprite({ name, cx, cy }: { name: string; cx: number; cy: number }) {
  const rows = MORDOR_SPRITES[name];
  if (!rows) return null;
  const sw = rows[0].length * PS;
  const sh = rows.length * PS;
  const x0 = cx - sw / 2;
  const y0 = cy - sh / 2;
  return (
    <>
      {rows.flatMap((row, ri) =>
        row.split('').map((c, ci) => {
          if (c === '.' || !MP[c]) return null;
          return (
            <rect
              key={`${ri}-${ci}`}
              x={x0 + ci * PS} y={y0 + ri * PS}
              width={PS} height={PS}
              fill={MP[c]} shapeRendering="crispEdges"
            />
          );
        })
      )}
    </>
  );
}

function EyeOfSauron({ cx, cy }: { cx: number; cy: number }) {
  const rx = 17, ry = 9;
  const flames = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const fr = rx + 7;
    return {
      x: Math.round(cx + Math.cos(a) * fr) - 1,
      y: Math.round(cy + Math.sin(a) * (fr * 0.52)) - 2,
      fill: i % 3 === 0 ? '#ff8800' : i % 3 === 1 ? '#ff4400' : '#cc2200',
    };
  });

  return (
    <g>
      {/* Pulsing outer halos */}
      <ellipse cx={cx} cy={cy} rx={rx + 16} ry={ry + 10} fill="#ff2200" opacity="0.04">
        <animate attributeName="opacity" values="0.02;0.18;0.02" dur="2.2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx={cx} cy={cy} rx={rx + 9} ry={ry + 5} fill="#ff4400" opacity="0.1">
        <animate attributeName="opacity" values="0.05;0.3;0.05" dur="1.8s" begin="-0.4s" repeatCount="indefinite" />
      </ellipse>

      {/* Rotating fire ring */}
      <g>
        <animateTransform attributeName="transform" type="rotate"
          from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`}
          dur="7s" repeatCount="indefinite" />
        {flames.map((f, i) => (
          <rect key={i} x={f.x} y={f.y} width={3} height={4} fill={f.fill} shapeRendering="crispEdges" />
        ))}
      </g>

      {/* Eye socket */}
      <ellipse cx={cx} cy={cy} rx={rx + 1} ry={ry + 1} fill="#1a0000" />
      {/* Iris layers */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#ff6600" />
      <ellipse cx={cx} cy={cy} rx={Math.round(rx * 0.8)} ry={Math.round(ry * 0.82)} fill="#ee3f00" />
      <ellipse cx={cx} cy={cy} rx={Math.round(rx * 0.52)} ry={Math.round(ry * 0.65)} fill="#cc1f00" />

      {/* Scanning vertical slit pupil */}
      <g>
        <animateTransform attributeName="transform" type="translate"
          values={`-5 0;5 0;-5 0`} dur="4s"
          calcMode="spline" keyTimes="0;0.5;1"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
          repeatCount="indefinite" />
        <ellipse cx={cx} cy={cy} rx={2} ry={Math.round(ry * 0.88)} fill="#050000" />
      </g>

      {/* Eyelid curves */}
      <path d={`M ${cx - rx} ${cy} Q ${cx} ${cy - ry - 5} ${cx + rx} ${cy}`} fill="none" stroke="#551100" strokeWidth="1.5" />
      <path d={`M ${cx - rx} ${cy} Q ${cx} ${cy + ry + 5} ${cx + rx} ${cy}`} fill="none" stroke="#551100" strokeWidth="1.5" />

      {/* Corner flicker flames */}
      <rect x={cx - rx - 3} y={cy - 3} width={3} height={5} fill="#ff5500" shapeRendering="crispEdges">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="0.9s" repeatCount="indefinite" />
      </rect>
      <rect x={cx + rx + 1} y={cy - 3} width={3} height={5} fill="#ff5500" shapeRendering="crispEdges">
        <animate attributeName="opacity" values="1;0.4;1" dur="0.9s" repeatCount="indefinite" />
      </rect>

      {/* Label */}
      <text x={cx} y={cy + ry + 14} textAnchor="middle"
        fill="#661100" fontSize="7" fontFamily="var(--font-headline)" fontWeight="bold" letterSpacing="1">
        EYE OF SAURON
      </text>
    </g>
  );
}

function SauronMarker({ cx, cy }: { cx: number; cy: number }) {
  // 10 cols × 9 rows — dark armored lord
  const sprite = [
    '....kk....',  // helmet spike tips
    '...kHHk...',  // upper helm dome
    '..kHEEHk..',  // visor with glowing eyes
    '..kHkHHk..',  // lower visor
    '.AkAAAAkA.',  // gold shoulder pauldrons
    '.AZZZZZA..',  // armored torso
    '..ZZZZZ...',  // lower torso
    '..kZ.Zk...',  // greaves
    '.kk...kk..',  // sabatons
  ];
  const sw = sprite[0].length * PS;
  const sh = sprite.length * PS;
  const x0 = cx - sw / 2;
  const y0 = cy - sh / 2;
  // Eyes are at row 2, cols 4-5 → vertical center of that row
  const eyeY = y0 + 2 * PS + PS / 2;

  const auraPts = [
    { x: x0 - 4, y: cy - 8, delay: '0s',     col: '#ff5500' },
    { x: x0 + sw + 2, y: cy - 8, delay: '-0.35s', col: '#cc2200' },
    { x: x0 - 4, y: cy + 4, delay: '-0.7s',  col: '#cc2200' },
    { x: x0 + sw + 2, y: cy + 4, delay: '-1.05s', col: '#ff5500' },
  ];

  return (
    <g>
      {/* Ground glow */}
      <ellipse cx={cx} cy={cy + sh / 2} rx="12" ry="4" fill="#ff4400" opacity="0.15">
        <animate attributeName="opacity" values="0.07;0.28;0.07" dur="1.6s" repeatCount="indefinite" />
      </ellipse>

      {/* Side aura flames */}
      {auraPts.map((f, i) => (
        <rect key={i} x={f.x} y={f.y} width={2} height={5}
          fill={f.col} shapeRendering="crispEdges">
          <animate attributeName="opacity" values="0.15;0.9;0.15" dur="0.65s" begin={f.delay} repeatCount="indefinite" />
          <animate attributeName="y" values={`${f.y};${f.y - 2};${f.y}`} dur="0.65s" begin={f.delay} repeatCount="indefinite" />
        </rect>
      ))}

      {/* Sprite pixels */}
      {sprite.flatMap((row, ri) =>
        row.split('').map((c, ci) => {
          if (c === '.' || !MP[c]) return null;
          return (
            <rect key={`${ri}-${ci}`}
              x={x0 + ci * PS} y={y0 + ri * PS}
              width={PS} height={PS}
              fill={MP[c]} shapeRendering="crispEdges"
            />
          );
        })
      )}

      {/* Eye glow pulse */}
      <ellipse cx={cx} cy={eyeY} rx={PS + 2} ry={PS * 0.75} fill="#ffaa00" opacity="0.45">
        <animate attributeName="opacity" values="0.15;0.75;0.15" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="rx" values={`${PS + 2};${PS + 5};${PS + 2}`} dur="1.8s" repeatCount="indefinite" />
      </ellipse>
    </g>
  );
}

function RoadToMordor({ distanceKm }: { distanceKm: number }) {
  const W = 1100, H = 215;
  const PL = 55, PR = 55;
  const PLOT_W = W - PL - PR;
  const PATH_Y = 150;
  const SPRITE_CY = 97;
  const EYE_CY = 46;

  const toX = (km: number) => PL + (Math.min(km, AT_FULL_KM_MORDOR) / AT_FULL_KM_MORDOR) * PLOT_W;
  const frodoX = toX(distanceKm);
  const doomX = toX(AT_FULL_KM_MORDOR);

  const pct = Math.min((distanceKm / AT_FULL_KM_MORDOR) * 100, 100).toFixed(1);
  const currentStage = [...MORDOR_MILESTONES].reverse().find(m => distanceKm >= m.km) ?? MORDOR_MILESTONES[0];
  const nextStage = MORDOR_MILESTONES.find(m => m.km > distanceKm);

  const stars = Array.from({ length: 55 }, (_, i) => ({
    cx: (i * 47 + 23) % W,
    cy: (i * 31 + 11) % 60 + 4,
    r: i % 5 === 0 ? 1.2 : 0.7,
    opacity: 0.15 + (i % 4) * 0.12,
  }));

  return (
    <div className={styles.mordorWrapper}>
      <div className={styles.mordorHeader}>
        <span className={styles.mordorCurrent}>{currentStage.name}</span>
        {nextStage && (
          <span className={styles.mordorNext}>
            → {nextStage.name} · {(nextStage.km - distanceKm).toFixed(0)} km
          </span>
        )}
        <span className={styles.mordorPct}>{pct}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="mSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#050510" />
            <stop offset="55%" stopColor="#160c04" />
            <stop offset="100%" stopColor="#221206" />
          </linearGradient>
          <linearGradient id="mGround" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#221206" />
            <stop offset="100%" stopColor="#130800" />
          </linearGradient>
          <linearGradient id="mPathDone" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#4a2a08" />
            <stop offset="100%" stopColor="#7a5220" />
          </linearGradient>
        </defs>

        {/* Sky + ground */}
        <rect width={W} height={PATH_Y + 6} fill="url(#mSky)" />
        <rect y={PATH_Y + 6} width={W} height={H - PATH_Y - 6} fill="url(#mGround)" />

        {/* Stars — skip the eye area */}
        {stars.filter(s => Math.abs(s.cx - doomX) > 28 || s.cy < 28 || s.cy > 68).map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.opacity} />
        ))}

        {/* Far mountain silhouettes (scaled to 1100px) */}
        <polygon
          points="0,105 69,62 151,82 248,52 344,75 440,58 550,88 646,55 743,70 839,62 935,80 1031,58 1100,75 1100,105"
          fill="#0c0c18" opacity="0.85"
        />
        <polygon
          points="0,112 55,72 124,92 206,68 289,88 385,74 481,98 578,70 674,84 770,76 866,90 963,72 1045,88 1100,78 1100,112"
          fill="#141414" opacity="0.95"
        />

        {/* Eye of Sauron — above Mount Doom */}
        <EyeOfSauron cx={doomX} cy={EYE_CY} />

        {/* Dark tower shaft connecting Eye to doom sprite */}
        <line x1={doomX} y1={EYE_CY + 11} x2={doomX} y2={SPRITE_CY - 14}
          stroke="#330000" strokeWidth="1" opacity="0.4" />

        {/* Road — unwalked */}
        <rect x={PL} y={PATH_Y - 5} width={PLOT_W} height={10} fill="#221408" rx="1" />
        <line x1={PL} y1={PATH_Y - 5} x2={W - PR} y2={PATH_Y - 5} stroke="#3a2010" strokeWidth="1" />
        <line x1={PL} y1={PATH_Y + 5} x2={W - PR} y2={PATH_Y + 5} stroke="#3a2010" strokeWidth="1" />

        {/* Road — walked */}
        {distanceKm > 0 && (
          <rect x={PL} y={PATH_Y - 5} width={frodoX - PL} height={10} fill="url(#mPathDone)" rx="1" />
        )}

        {/* Milestones */}
        {MORDOR_MILESTONES.map((m) => {
          const mx = toX(m.km);
          const reached = distanceKm >= m.km;
          const spriteH = (MORDOR_SPRITES[m.sprite]?.length ?? 5) * PS;
          const connectorTop = SPRITE_CY + spriteH / 2 + 2;

          return (
            <g key={m.name}>
              <line x1={mx} y1={PATH_Y - 5} x2={mx} y2={connectorTop}
                stroke={reached ? '#7a5020' : '#2a1a08'} strokeWidth="1"
                strokeDasharray={reached ? undefined : '2,2'} />
              <MordorSprite name={m.sprite} cx={mx} cy={SPRITE_CY} />
              {reached
                ? <circle cx={mx} cy={PATH_Y} r="4" fill={m.km === AT_FULL_KM_MORDOR ? '#ff6600' : '#aa7730'} opacity="0.9" />
                : <circle cx={mx} cy={PATH_Y} r="3" fill="#221408" stroke="#3a2010" strokeWidth="1" />
              }
              <text x={mx} y={PATH_Y + 17} textAnchor="middle"
                fill={reached ? '#cc9944' : '#3a2810'} fontSize="8"
                fontFamily="var(--font-headline)" fontWeight="bold">
                {m.name}
              </text>
              <text x={mx} y={PATH_Y + 27} textAnchor="middle"
                fill={reached ? '#886622' : '#2a1a08'} fontSize="6.5"
                fontFamily="var(--font-headline)">
                {m.place}
              </text>
            </g>
          );
        })}

        {/* Sauron position marker */}
        {distanceKm > 0 && <SauronMarker cx={frodoX} cy={PATH_Y - 23} />}

        {/* Footer */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#3a2810" fontSize="8" fontFamily="var(--font-headline)">
          {distanceKm.toFixed(0)} KM / {AT_FULL_KM_MORDOR} KM — {pct}% TO KATAHDIN
        </text>
      </svg>
    </div>
  );
}

// ─── Beer Calculator ───────────────────────────────────────────────────────────

function BeerCalculator({ distanceKm }: { distanceKm: number }) {
  const calBurned = distanceKm * CAL_PER_KM;
  const beersEarned = Math.floor(calBurned / BEER_CAL);
  const totalCal = beersEarned * BEER_CAL;
  const totalCarbs = beersEarned * BEER_CARBS;
  const totalAlcohol = beersEarned * BEER_ALCOHOL_G;

  return (
    <div className={styles.beerCalc}>
      <div className={styles.beerCalcHero}>
        <span className={styles.beerCalcBeers}>{beersEarned}</span>
        <span className={styles.statsLabel}>BEERS_EARNED</span>
        <span className={styles.beerCalcEmoji}>
          {Array.from({ length: Math.min(beersEarned, 15) }).map((_, i) => (
            <span key={i}>🍺</span>
          ))}
          {beersEarned > 15 && <span>...</span>}
        </span>
      </div>
      <div className={styles.beerCalcStats}>
        <div className={styles.beerCalcStat}>
          <span className={styles.statsLabel}>CAL_BURNED</span>
          <span className={styles.beerCalcValue}>{Math.round(calBurned)}<span className={styles.beerCalcUnit}>KCAL</span></span>
        </div>
        <div className={styles.beerCalcStat}>
          <span className={styles.statsLabel}>BEER_CAL</span>
          <span className={styles.beerCalcValue}>{totalCal}<span className={styles.beerCalcUnit}>KCAL</span></span>
        </div>
        <div className={styles.beerCalcStat}>
          <span className={styles.statsLabel}>CARBS</span>
          <span className={styles.beerCalcValue}>{totalCarbs.toFixed(0)}<span className={styles.beerCalcUnit}>G</span></span>
        </div>
        <div className={styles.beerCalcStat}>
          <span className={styles.statsLabel}>ALCOHOL</span>
          <span className={styles.beerCalcValue}>{totalAlcohol.toFixed(0)}<span className={styles.beerCalcUnit}>G</span></span>
        </div>
      </div>
      <div className={styles.beerCalcFootnote}>
        {distanceKm.toFixed(0)} km hiked × {CAL_PER_KM} cal/km = {Math.round(calBurned)} kcal ÷ {BEER_CAL} cal/beer
      </div>
    </div>
  );
}

export function StatsPage({ points, stravaActivities, totalDistanceKm, totalElevationGain, isAdmin, onClose }: StatsPageProps) {
  const [hoveredCell, setHoveredCell] = useState<{ date: string; km: number; x: number; y: number } | null>(null);

  const stats = useMemo(() => {
    const stravaDistanceKm = stravaActivities.reduce((sum, a) => sum + ((a.distance || 0) / 1000), 0);
    const stravaElevation = stravaActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0);

    const garminPoints = points.filter(p => !p.garminId?.startsWith('manual-'));

    let avgSpeed = 0;
    if (garminPoints.length >= 2) {
      const first = new Date(garminPoints[0].timestamp).getTime();
      const last = new Date(garminPoints[garminPoints.length - 1].timestamp).getTime();
      const hours = (last - first) / 3600000;
      if (hours > 0) avgSpeed = totalDistanceKm / hours;
    }

    const allDates = new Set<string>();
    garminPoints.forEach(p => allDates.add(new Date(p.timestamp).toDateString()));
    stravaActivities.forEach(a => {
      if (a.startDate) allDates.add(new Date(a.startDate).toDateString());
    });

    const combinedDist = totalDistanceKm + stravaDistanceKm;
    const combinedElev = totalElevationGain + stravaElevation;
    const progress = Math.min((combinedDist / AT_TOTAL_KM) * 100, 100);

    return {
      garminDist: totalDistanceKm,
      garminElev: totalElevationGain,
      stravaDist: stravaDistanceKm,
      stravaElev: stravaElevation,
      combinedDist,
      combinedElev,
      trackingPoints: points.length,
      stravaCount: stravaActivities.length,
      avgSpeed,
      daysOnTrail: allDates.size,
      progress,
    };
  }, [points, stravaActivities, totalDistanceKm, totalElevationGain]);

  const dailyKm = useMemo(() => buildDailyKm(points, stravaActivities), [points, stravaActivities]);
  const { weeks, months } = useMemo(() => getFixedWeeksGrid(dailyKm), [dailyKm]);
  const activeDays = Object.entries(dailyKm).filter(([date, km]) => {
    return km > 0 && date >= HIKE_START && date <= HIKE_END;
  }).length;

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const recentPoints = useMemo(() => {
    return [...points]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [points]);

  return (
    <div className={styles.statsPage}>
      <div className={styles.statsPageHeader}>
        <h2>TRAIL_PERFORMANCE</h2>
        <button onClick={onClose}>CLOSE</button>
      </div>

      <div className={styles.statsPageContent}>
        {/* Progress section */}
        <section className={styles.statsSection}>
          <div className={styles.statsProgressHeader}>
            <div>
              <span className={styles.statsLabel}>TOTAL_DISTANCE</span>
              <div className={styles.statsHeroValue}>
                <span className={styles.statsHeroNumber}>{stats.combinedDist.toFixed(0)}</span>
                <span className={styles.statsHeroUnit}>/ {AT_TOTAL_KM} KM</span>
              </div>
            </div>
            <div className={styles.statsProgressPct}>
              <span className={styles.statsLabel}>THRU_AT</span>
              <span className={styles.statsBigValue}>{stats.progress.toFixed(1)}%</span>
            </div>
          </div>
          <div className={styles.statsProgressBars}>
            <div className={`${styles.statsProgressBar} ${styles.statsProgressBarFull}`}>
              <div className={`${styles.statsProgressFill} ${styles.statsProgressFillFull}`} style={{ width: `${(stats.combinedDist / 3500) * 100}%` }} />
              <span className={styles.statsProgressLabel}>FULL AT — 3,500 KM ({((stats.combinedDist / 3500) * 100).toFixed(1)}%)</span>
            </div>
            <div className={styles.statsProgressBar}>
              <div className={styles.statsProgressFill} style={{ width: `${stats.progress}%` }} />
              <span className={styles.statsProgressLabel}>GOAL — {AT_TOTAL_KM} KM</span>
            </div>
          </div>
        </section>

        {/* Bento grid */}
        <section className={styles.statsBento}>
          <div className={`${styles.statsBentoCard} ${styles.statsBentoAccent}`}>
            <span className={styles.statsLabel}>DAYS_ON_TRAIL</span>
            <span className={styles.statsBentoNumber}>{stats.daysOnTrail}</span>
          </div>
          <div className={styles.statsBentoCard}>
            <span className={styles.statsLabel}>TOTAL_ASCENT</span>
            <div className={styles.statsBentoNumber}>{Math.round(stats.combinedElev)}<span className={styles.statsBentoUnit}>M</span></div>
          </div>
          <div className={styles.statsBentoCard}>
            <span className={styles.statsLabel}>TRACKING_PTS</span>
            <span className={styles.statsBentoNumber}>{stats.trackingPoints}</span>
          </div>
          <div className={styles.statsBentoCard}>
            <span className={styles.statsLabel}>STRAVA_ACTIVITIES</span>
            <span className={styles.statsBentoNumber}>{stats.stravaCount}</span>
          </div>
          {stats.avgSpeed > 0 && (
            <div className={styles.statsBentoCard}>
              <span className={styles.statsLabel}>AVG_SPEED</span>
              <div className={styles.statsBentoNumber}>{stats.avgSpeed.toFixed(1)}<span className={styles.statsBentoUnit}>KM/H</span></div>
            </div>
          )}
          <div className={styles.statsBentoCard}>
            <span className={styles.statsLabel}>GARMIN_DIST</span>
            <div className={styles.statsBentoNumber}>{stats.garminDist.toFixed(1)}<span className={styles.statsBentoUnit}>KM</span></div>
          </div>
          <div className={styles.statsBentoCard}>
            <span className={styles.statsLabel}>STRAVA_DIST</span>
            <div className={styles.statsBentoNumber}>{stats.stravaDist.toFixed(1)}<span className={styles.statsBentoUnit}>KM</span></div>
          </div>
        </section>

        {/* Road to Mordor */}
        <section className={styles.statsSection} style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '24px 24px 0' }}>
            <h3 className={styles.statsSectionTitle}>ROAD_TO_MORDOR</h3>
          </div>
          <RoadToMordor distanceKm={stats.combinedDist} />
        </section>

        {/* Activity heatmap */}
        <section className={styles.statsSection}>
          <div className={styles.statsHeatmapHeader}>
            <h3>ACTIVITY_LOG</h3>
            <span className={styles.statsLabel}>{activeDays} / 90 ACTIVE_DAYS</span>
          </div>
          <div className={styles.heatmapWrapper} style={{ position: 'relative' }}>
            {/* Month labels */}
            <div className={styles.heatmapMonthsRow} style={{ position: 'relative', height: 16, marginLeft: 20, marginBottom: 2 }}>
              {months.map((m, i) => (
                <span
                  key={i}
                  className={styles.heatmapMonthLabel}
                  style={{ position: 'absolute', left: m.weekIndex * 13 }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            {/* Grid with day labels */}
            <div style={{ display: 'flex', gap: 0 }}>
              {/* Day of week labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {DAY_LABELS.map((label, i) => (
                  <span key={i} className={styles.heatmapDayLabel}>{i % 2 === 0 ? label : ''}</span>
                ))}
              </div>
              {/* The grid — iterate column-first (week by week) */}
              <div className={styles.heatmapGrid}>
                {weeks.map((week, col) => (
                  Array.from({ length: 7 }).map((_, row) => {
                    const cell = week[row];
                    if (!cell) return <div key={`${col}-${row}`} className={`${styles.heatmapCell} ${styles.heatmapCellEmpty}`} />;
                    return (
                      <div
                        key={`${col}-${row}`}
                        className={`${styles.heatmapCell} ${intensityClass(cell.km)}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            date: cell.date,
                            km: cell.km,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        onTouchStart={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoveredCell({
                            date: cell.date,
                            km: cell.km,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onTouchEnd={() => setHoveredCell(null)}
                      />
                    );
                  })
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className={styles.heatmapLegend}>
              <span className={styles.statsLabel}>0 KM</span>
              <div className={`${styles.heatmapCell} ${styles.heatmapCell0}`} />
              <div className={`${styles.heatmapCell} ${styles.heatmapCell1}`} />
              <div className={`${styles.heatmapCell} ${styles.heatmapCell2}`} />
              <div className={`${styles.heatmapCell} ${styles.heatmapCell3}`} />
              <div className={`${styles.heatmapCell} ${styles.heatmapCell4}`} />
              <span className={styles.statsLabel}>30+ KM</span>
            </div>
            {/* Tooltip */}
            {hoveredCell && (
              <div
                className={styles.heatmapTooltip}
                style={{
                  position: 'fixed',
                  left: hoveredCell.x,
                  top: hoveredCell.y - 8,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <strong>{hoveredCell.km.toFixed(1)} km</strong>
                <span>{hoveredCell.date}</span>
              </div>
            )}
          </div>
        </section>

        {/* AT Trail altitude profile */}
        <section className={styles.statsSection}>
          <h3 className={styles.statsSectionTitle}>AT_TRAIL_PROFILE</h3>
          <TrailAltitudeProfile hikerDistanceKm={stats.combinedDist} isAdmin={isAdmin} />
        </section>

        {/* Elevation profile from tracking */}
        <section className={styles.statsSection}>
          <h3 className={styles.statsSectionTitle}>ELEVATION_PROFILE</h3>
          <ElevationChart points={points} />
        </section>

        {/* Beer calculator */}
        <section className={styles.statsSection}>
          <h3 className={styles.statsSectionTitle}>BEER_CALCULATOR</h3>
          <BeerCalculator distanceKm={stats.combinedDist} />
        </section>

        {/* Recent events */}
        <section className={styles.statsSection}>
          <h3 className={styles.statsSectionTitle}>RECENT_EVENTS</h3>
          <div className={styles.statsEvents}>
            {recentPoints.map((pt) => {
              const time = new Date(pt.timestamp);
              return (
                <div key={pt.id} className={styles.statsEvent}>
                  <div className={styles.statsEventInfo}>
                    <span className={styles.statsEventType}>
                      {pt.eventType || 'TRACKING'}
                    </span>
                    <span className={styles.statsEventCoords}>
                      {pt.latitude.toFixed(4)}, {pt.longitude.toFixed(4)}
                    </span>
                    {pt.message && <span className={styles.statsEventMsg}>{pt.message}</span>}
                  </div>
                  <span className={styles.statsEventTime}>
                    {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
