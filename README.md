# Trackpath

Web app for tracking a thru-hike on the Appalachian Trail — live GPS position via a Garmin inReach, activity data from Strava, plus stats, gear list, and admin tools. NestJS + React monorepo, deployed on Railway.

## Features

- **Interactive map** — AT trail line, Garmin track + points, Strava activities, weather overlay, tag/highlight layers, street or topo tiles, all independently toggleable
- **Garmin inReach sync** — pulls GPS pings from the MapShare KML feed; auto-polls on an interval plus manual/date-range backfill
- **Strava sync** — OAuth-connected activity + GPS stream sync; auto daily plus manual/date-range backfill
- **Admin-configurable sync periods** — restrict which date ranges get synced/kept for both Garmin and Strava, so gaps (e.g. time off-trail) don't pollute the data
- **Trail stats** — daily distance/elevation charts and activity heatmap, moving-average speed, zero-day tracking, elevation profile, a beer calculator, and a lighthearted progress bar
- **Gear list** — packing list with per-category weight totals
- **Trail log** — chronological feed of device pings and manual entries, taggable (resupply, water, camp, shelter, etc.)
- **Weather** — short-range forecast via Open-Meteo
- **Polls & Cheers** — reader polls with suggestions, and a guestbook-style message board
- **Admin panel** — sync status/logs, manual sync triggers, sync period management, poll/cheer moderation
- **GitHub login** (better-auth) — gates write endpoints behind a configurable admin allowlist
- **Installable PWA**, with a couple of hidden layer-toggle Easter eggs

## Architecture

Turborepo + npm workspaces monorepo:

```
apps/
  api/      NestJS backend (@trackpath/api) — REST API, Garmin/Strava sync, auth, admin
  web/      React 19 + Vite frontend (@trackpath/web) — the map UI
packages/
  db/       Drizzle ORM schema + migrations (@trackpath/db), PostgreSQL
```

See `CLAUDE.md` for a full module-by-module breakdown and conventions.

## Prerequisites

- Node.js 22+
- PostgreSQL 16+ (a `docker-compose.yml` is included for local dev)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start a local Postgres** (or point `DATABASE_URL` at your own instance)

   ```bash
   docker compose up -d
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   | Variable | Required | Purpose |
   |---|---|---|
   | `DATABASE_URL` | yes | PostgreSQL connection string |
   | `BETTER_AUTH_SECRET` | yes | Session signing secret — generate with `openssl rand -base64 32` |
   | `BETTER_AUTH_URL` | no | Base URL for auth callbacks (defaults to `http://localhost:3001`) |
   | `ADMIN_EMAILS` | no | Comma-separated emails allowed to write; empty means any signed-in user is admin |
   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no | GitHub OAuth login ([create one](https://github.com/settings/developers)) — login is disabled without these |
   | `MAPSHARE_ID` | no | Garmin inReach MapShare ID — enables Garmin sync |
   | `POLL_INTERVAL_MIN` | no | Garmin auto-sync interval in minutes (default `5`) |
   | `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | no | Strava OAuth ([create one](https://www.strava.com/settings/api)) — enables Strava sync |
   | `NEST_PORT` | no | API port for local dev (default `3001`) |

   ### Finding your MapShare ID

   1. Sign in at [explore.garmin.com](https://explore.garmin.com)
   2. Go to **Social** → enable **MapShare**
   3. Your MapShare URL is `share.garmin.com/YourShareName` — the last part is your `MAPSHARE_ID`

4. **Run database migrations**

   ```bash
   npm run migrate
   ```

5. **Start the app**

   ```bash
   npm run dev
   ```

   This runs the API (NestJS, watch mode) on [http://localhost:3001](http://localhost:3001) and the frontend (Vite) on [http://localhost:5173](http://localhost:5173), with `/api` proxied from the frontend to the backend.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start API + web in watch mode |
| `npm run build` | Build all packages/apps |
| `npm run start` | Run the built API in production mode |
| `npm run migrate` | Apply pending DB migrations |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run type-check` | Type-check all packages |
| `npm run lint` | Lint all packages |
| `npm run test` | Run tests |

## Deployment

Deployed on [Railway](https://railway.app) via the root `Dockerfile` — a multi-stage build that compiles the whole monorepo, then runs `npm run migrate && npm run start` on boot. Railway supplies `DATABASE_URL` and `PORT`; everything else in the table above is set as a Railway environment variable.

The Railway project itself (service, database, domain, variables) is declared in `.railway/railway.ts` — edit that file and run `railway config plan` / `railway config apply` instead of changing settings in the dashboard. Secret values stay in Railway (`preserve()`). See `docs/adr/0001-railway-infrastructure-as-code.md`.
