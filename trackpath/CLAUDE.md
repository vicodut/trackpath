# Trackpath — Claude Code Guide

## Project overview
Appalachian Trail hike tracker. NestJS API + React SPA, deployed on Railway.

- **Backend:** Node.js + NestJS 11, TypeScript (SWC), Drizzle ORM, PostgreSQL
- **Frontend:** React 19, Vite, react-leaflet, CSS Modules
- **Auth:** better-auth (GitHub OAuth)
- **Deploy:** Railway via Dockerfile; runs `npm run migrate && npm run start`
- **Monorepo:** Turborepo + npm workspaces (`apps/api`, `apps/web`, `packages/db`)

## Commands

```bash
npm run dev          # turbo dev → db watcher + nest --watch (3001) + vite (5173)
npm run build        # turbo build → packages/db → apps/api + apps/web in parallel
npm run start        # NODE_ENV=production node apps/api/dist/main.js
npm run migrate      # drizzle migrator in packages/db (runs at Railway deploy)
npm run db:generate  # drizzle-kit generate → SQL in packages/db/drizzle/
npm run type-check   # turbo type-check across all packages
npm run lint         # turbo lint across all packages
```

## Architecture

```
apps/
  api/                      # NestJS backend (@trackpath/api)
    src/
      main.ts               # Bootstrap (static files, auth handler, validation)
      app.module.ts         # Root module — imports all feature modules
      auth/                 # AuthService (better-auth), AdminGuard
      garmin/               # GarminService (MapShare sync), GarminController
      strava/               # StravaService (OAuth + activity sync), StravaController
      blog/                 # BlogService (Ghost CMS proxy), BlogController
      weather/              # WeatherService (Open-Meteo, 30-min cache), WeatherController
      gear/                 # GearService + GearController (categories + items)
      admin/                # AdminService (dashboard aggregation), AdminController
      health/               # HealthController (/api/health, /api/health/db)
      config/               # ConfigModule — Zod-validated env vars
      database/             # DatabaseModule — global Drizzle + SQL_CLIENT providers
    dist/
      main.js               # Compiled entry
      client/               # Vite build output (served as static files in prod)
  web/                      # Vite React frontend (@trackpath/web)
    src/
      components/           # React components, one folder per component
      hooks/                # Custom React hooks (usePoints, useAdmin, useStrava, …)
      api/                  # Thin fetch wrappers for each API resource
      lib/                  # Pure utilities (geo, math)
      types.ts              # Shared client types
    public/                 # Static assets (PWA manifest, sw.js, icons, JSON data)
packages/
  db/                       # Drizzle schema + migrations (@trackpath/db)
    src/
      index.ts              # Exports: db client, sql client
      schema.ts             # All table definitions (source of truth)
      migrate.ts            # Migration runner
    drizzle/                # Generated SQL migrations — commit these
```

## Adding a new API route

1. Create or update the relevant `apps/api/src/<module>/` directory.
2. Add a DTO class in `<module>.dto.ts` with `class-validator` decorators.
3. Inject `DRIZZLE` (typed `DrizzleClient`) via `@Inject(DRIZZLE)` for DB access.
4. Guard admin routes with `@UseGuards(AdminGuard)`.
5. Import the module in `apps/api/src/app.module.ts`.

## Key conventions

- **DB schema changes:** edit `packages/db/src/schema.ts` → `npm run db:generate` → commit the generated SQL. Never hand-edit migration files.
- **DB imports in API:** use workspace package `import { db } from '@trackpath/db'` and `import { table } from '@trackpath/db/schema'`. Never use relative paths to packages/db.
- **Server helpers:** add targeted query helpers instead of reusing `getAllPoints()` for everything.
- **React state:** prefer `useMemo`/`useCallback` for expensive derivations. Use imperative handles (`useImperativeHandle`) for cross-component calls that would otherwise cause full re-renders.
- **Modal pages** (AdminPage, StatsPage, GearPage, TrailLogPage, Blog) are lazy-loaded — keep them out of the initial bundle.
- **CSS:** CSS Modules per component (`ComponentName.module.css`). No global styles except `index.css`.
- **TypeScript Strictness:** Never use `any` or `@ts-ignore`. If a type is missing, define it in `apps/web/src/types.ts` or infer it from the Drizzle schema.
- **Routing:** Do not add new routes directly to `main.ts`. Create a NestJS module with a controller and register it in `app.module.ts`.
- **Validation:** Use `class-validator` DTO classes for all request bodies. The global `ValidationPipe` (whitelist + transform) is active — unknown fields are stripped automatically.
- **Rate limiting:** Sync/write endpoints use `@Throttle({ default: { ttl: 60_000, limit: 5 } })`. The global default is 120 req/min.
- **Package Management:** Use standard Node/Vite/React APIs first. Ask for permission before running `npm install` for any new dependency.

## Domain Rules (The Trail Reality)
- **Spotty Connectivity:** Assume Garmin MapShare pings or user-generated logs might arrive out of order, in batches, or delayed by several days. Always rely on the device timestamp, not the server ingestion time.
- **Data Integrity:** Coordinate data (latitude/longitude/elevation) is the source of truth. Never mutate historical coordinate data once written.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `MAPSHARE_ID` | Garmin inReach MapShare ID |
| `ADMIN_EMAILS` | Comma-separated list of admin emails |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava OAuth |
| `BETTER_AUTH_URL` | Base URL for auth callbacks |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `GHOST_URL` / `GHOST_KEY` | Ghost CMS for blog |
| `POLL_INTERVAL_MIN` | Garmin auto-sync interval (default 5) |
| `NEST_PORT` | NestJS port for local dev (default 3001) |

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout: `CONTEXT.md` + `docs/adr/` at the project root. See `docs/agents/domain.md`.

## Do not

- Hand-edit files in `packages/db/drizzle/` — always use `db:generate`
- Use `getAllPoints()` for endpoints that only need count or the latest point
- Add `--no-verify` to git commands or skip migration on deploy
- Import modal page components statically in App.tsx
- Push directly
- Hallucinate or install new npm packages without explicit permission.
- Write raw SQL queries; always use the Drizzle ORM query builder or relational queries.
- Delete existing comments or JSDoc strings when modifying a function.
- Use relative paths across workspace boundaries — always use `@trackpath/db` imports.
