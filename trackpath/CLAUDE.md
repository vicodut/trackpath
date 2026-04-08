# Trackpath — Claude Code Guide

## Project overview
Appalachian Trail hike tracker. Express API + React SPA, deployed on Railway.

- **Backend:** Node.js + Express 5, TypeScript (tsx), Drizzle ORM, PostgreSQL
- **Frontend:** React 19, Vite, react-leaflet, CSS Modules
- **Auth:** better-auth (email/OAuth)
- **Deploy:** Railway via Dockerfile; runs `npm run migrate && npm start`

## Commands

```bash
npm run dev          # concurrently: vite (port 5173) + tsx watch server
npm run build        # vite build → dist/client/
npm start            # NODE_ENV=production tsx src/server/index.ts
npm run migrate      # drizzle-orm migrator (runs all pending migrations)
npm run db:generate  # drizzle-kit generate → creates SQL in drizzle/
npm run lint         # eslint src/
npm run type-check   # tsc --noEmit (client + server)
```

## Architecture

```
src/
  client/
    components/   # React components, one folder per component
    hooks/        # Custom React hooks (usePoints, useAdmin, useStrava, …)
    api/          # Thin fetch wrappers for each API resource
    lib/          # Pure utilities (geo, math)
    types.ts      # Shared client types
  server/
    index.ts      # All Express routes + helpers
    auth.ts       # better-auth config
  db/
    index.ts      # Drizzle client + raw postgres-js client
    schema.ts     # All table definitions
    migrate.ts    # Migration runner (used by npm run migrate)
drizzle/          # Generated SQL migrations — commit these
```

## Key conventions

- **DB schema changes:** edit `src/db/schema.ts` → `npm run db:generate` → commit the generated SQL. Never hand-edit migration files.
- **Server helpers:** add targeted query helpers (e.g. `getLastGarminPoint()`) instead of reusing `getAllPoints()` for everything.
- **React state:** prefer `useMemo`/`useCallback` for expensive derivations. Use imperative handles (`useImperativeHandle`) for cross-component calls that would otherwise cause full re-renders (e.g. map cursor updates from elevation profile hover).
- **Modal pages** (AdminPage, StatsPage, GearPage, TrailLogPage, Blog) are lazy-loaded — keep them out of the initial bundle.
- **CSS:** CSS Modules per component (`ComponentName.module.css`). No global styles except `index.css`.

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

## Do not

- Hand-edit files in `drizzle/` — always use `db:generate`
- Use `getAllPoints()` for endpoints that only need count or the latest point
- Add `--no-verify` to git commands or skip migration on deploy
- Import modal page components statically in App.tsx
