# AT Tracker — Architecture

A real-time Appalachian Trail thru-hike tracker with Garmin inReach integration, Strava sync, interactive map, elevation profiles, trail highlights, and a Ghost CMS-powered trail journal.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Client (React)                      │
│  Vite · React 19 · Leaflet · CSS Modules · TypeScript   │
└──────────────────────────┬──────────────────────────────┘
                           │ /api/*
┌──────────────────────────▼──────────────────────────────┐
│                    Server (Express 5)                     │
│  tsx · better-auth · Drizzle ORM · Node.js              │
└───────┬──────────┬──────────┬──────────┬────────────────┘
        │          │          │          │
   ┌────▼───┐ ┌───▼────┐ ┌───▼───┐ ┌───▼──────┐
   │Postgres│ │ Garmin  │ │Strava │ │Ghost CMS │
   │  (DB)  │ │inReach  │ │  API  │ │   API    │
   └────────┘ └────────┘ └───────┘ └──────────┘
```

## Data Sources

| Source | What | How |
|--------|------|-----|
| **Garmin inReach** | GPS tracking points (lat, lon, alt, timestamp, messages) | Server polls MapShare KML feed every 5 min |
| **Strava** | Hiking activities (distance, elevation, GPS traces) | OAuth2 connect, auto-sync every 24h |
| **Ghost CMS** | Trail journal blog posts | Proxied through `/api/blog/*` (Content API, read-only) |
| **OpenStreetMap** | AT trail highlights (shelters, summits, towns, etc.) | One-time fetch via Overpass API, stored in `public/at-highlights.json` |
| **Open-Meteo** | Trail elevation data + weather forecast | Elevation: one-time fetch for profile. Weather: live at last position |

## Client Architecture

### Tech Stack
- **React 19** + TypeScript
- **Vite 8** (Rolldown bundler)
- **Leaflet** + react-leaflet for interactive maps
- **CSS Modules** (per-component scoped styles)
- **vaul** for mobile drawer

### File Structure

```
src/client/
├── App.tsx                    # Root component (~170 lines)
├── main.tsx                   # Entry point, wraps in ErrorBoundary
├── types.ts                   # TrackingPoint, StravaActivity interfaces
├── theme.ts                   # Color tokens for JS (Leaflet icons, SVG)
│
├── hooks/
│   ├── usePoints.ts           # Tracking points CRUD, distance/elevation calc
│   ├── useAdmin.ts            # Session + admin check
│   ├── useStrava.ts           # Strava activities, connect, sync
│   ├── useModals.ts           # Modal state (admin, stats, trailLog, blog)
│   ├── useAddPoint.ts         # Add point flow (form, coords, submit)
│   ├── useTrailDistance.ts    # Trail-aware distance between two points
│   └── useIsMobile.ts         # Responsive breakpoint hook
│
├── lib/
│   ├── constants.ts           # TAG_EMOJIS, TAGS, MOBILE_BREAKPOINT
│   ├── geo.ts                 # Haversine distance formula
│   ├── format.ts              # formatDuration helper
│   └── auth-client.ts         # better-auth client
│
├── data/
│   └── iconic-summits.ts      # 15 notable AT summits with trail distances
│
├── components/
│   ├── Map/                   # Leaflet map + all map sub-components
│   ├── MapElevationProfile/   # Collapsible elevation chart (bottom of map)
│   ├── HighlightsLayer/       # AT POI markers (shelters, summits, towns)
│   ├── Header/                # Top nav bar + hamburger menu (mobile)
│   ├── Sidebar/               # Desktop sidebar + mobile add-point drawer
│   ├── AddPointForm/          # Admin form to add tracking points
│   ├── PointCard/             # Single point in the trail log list
│   ├── PointPopup/            # Mobile bottom sheet for point details
│   ├── LayerToggle/           # Map layer visibility controls
│   ├── Weather/               # Weather forecast at last position
│   ├── Stats/                 # Compact stats overlay on map
│   ├── StatsPage/             # Full stats page (charts, heatmap, beer calc)
│   ├── AdminPage/             # Admin panel (sync controls, status)
│   ├── TrailLogPage/          # Mobile full-screen point list
│   ├── Blog/                  # Ghost CMS journal (list + article reader)
│   ├── StatusBar/             # Bottom status bar
│   └── ErrorBoundary/         # Catches React errors, shows reload page
│
└── styles/
    └── index.css              # Global styles only (root vars, resets, layout)
```

### Key Patterns
- **CSS Modules**: Each component has `ComponentName.module.css`, scoped class names
- **Custom hooks**: State extracted from App.tsx into focused hooks
- **Shared constants**: `lib/constants.ts` is single source of truth for tags, breakpoints
- **Theme tokens**: `theme.ts` for JS colors (Leaflet), CSS vars for styles
- **React.memo**: Leaf components (PointCard, StatusBar, Weather) memoized

## Server Architecture

### Tech Stack
- **Express 5** + TypeScript (via tsx)
- **better-auth** (GitHub OAuth)
- **Drizzle ORM** + PostgreSQL
- **dotenv** for environment config

### File Structure

```
src/server/
├── index.ts           # Routes, middleware, polling, startup (~650 lines)
├── auth.ts            # better-auth config (GitHub OAuth, trusted origins)

src/db/
├── schema.ts          # Drizzle table definitions
├── index.ts           # Database connection
```

### API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/me` | No | Current user + admin status |
| GET | `/api/points` | No | All tracking points |
| POST | `/api/points` | Admin | Add manual point |
| DELETE | `/api/points/:id` | Admin | Delete point |
| POST | `/api/sync` | Admin | Manual Garmin sync |
| GET | `/api/sync-status` | No | Polling status |
| GET | `/api/weather` | No | Forecast at last position |
| GET | `/api/strava/status` | No | Strava connection status |
| GET | `/api/strava/activities` | No | All Strava activities |
| GET | `/api/strava/connect` | Admin | Start Strava OAuth |
| GET | `/api/strava/callback` | No | Strava OAuth callback |
| POST | `/api/strava/sync` | Admin | Manual Strava sync |
| GET | `/api/blog/posts` | No | Ghost CMS posts (proxied) |
| GET | `/api/blog/posts/:slug` | No | Single Ghost post (proxied) |
| GET | `/api/admin/status` | Admin | Admin dashboard data |
| ALL | `/api/auth/*` | No | better-auth handlers |

### Background Jobs
- **Garmin auto-poll**: Every 5 min (configurable via `POLL_INTERVAL_MIN`)
- **Strava auto-sync**: Every 24h

### Security
- Admin auth via `ADMIN_EMAILS` whitelist
- Ghost API key proxied through server (not exposed to client)
- HTML sanitization with DOMPurify on Ghost content
- Input validation on POST endpoints (type + range checks)
- Token refresh race condition protection (request coalescing)
- Graceful shutdown on SIGTERM/SIGINT

## Static Data Files

```
public/
├── at-trail.json              # Full AT trail coordinates (9928 points)
├── at-trail-elevation.json    # Sampled trail with elevation (498 points)
├── at-highlights.json         # POIs: 1524 shelters, summits, towns, etc.
├── sasquatch.gif              # Hiker position marker
├── sasquatch-icon.gif         # Header icon
└── favicon.png
```

Generated by scripts:
- `npm run fetch:elevations` — queries Open-Meteo for elevation data
- `npm run fetch:highlights` — queries Overpass API for AT POIs

## Database Schema

```
tracking_points          # Garmin + manual tracking points
├── id (SERIAL PK)
├── garmin_id (TEXT UNIQUE) — "manual-{timestamp}" for admin-added
├── latitude, longitude, altitude
├── timestamp, velocity, course
├── message, event_type
└── created_at

strava_activities        # Synced Strava workouts
├── id (SERIAL PK)
├── strava_id (BIGINT)
├── name, type, distance, moving_time, elevation_gain
├── start_date, coords (JSON text)
└── created_at

strava_tokens            # OAuth tokens
├── id (SERIAL PK)
├── access_token, refresh_token, expires_at
└── athlete_id

user, session, account, verification  # better-auth tables
```

## Deployment (Railway)

```
Railway Project
├── Web Service (this app)
│   ├── Dockerfile (multi-stage: node:22 build → node:22-slim prod)
│   ├── PostgreSQL addon
│   └── Environment variables from .env
├── Ghost CMS (separate service)
└── Ollama (separate service, optional)
```

## Development

```bash
git clone <repo>
cp .env.example .env    # Fill in secrets
npm install
npm run dev             # Starts both server (3000) + Vite (5173)
```

### Available Scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server + client |
| `npm run build` | Build client for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint (strictTypeChecked) |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run type-check` | TypeScript check (client + server) |
| `npm run fetch:highlights` | Regenerate AT POI data from Overpass |
| `npm run fetch:elevations` | Regenerate elevation profile data |
