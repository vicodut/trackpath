# Trackpath — Agent Guide

## Project overview
Appalachian Trail hike tracker. NestJS API + React SPA, deployed on Railway as one process.

- **Backend:** Node.js 22 + NestJS 11, TypeScript (SWC build, `tsc` only for type-check), Drizzle ORM, PostgreSQL
- **Frontend:** React 19, Vite 8, react-leaflet, CSS Modules
- **Auth:** better-auth (GitHub OAuth) + `ADMIN_EMAILS` allowlist
- **Deploy:** Railway via the root `Dockerfile`; container runs `npm run migrate && npm run start`. Railway project config is code in `.railway/railway.ts` (see `docs/adr/0001-railway-infrastructure-as-code.md`)
- **Monorepo:** Turborepo + npm workspaces (`apps/api`, `apps/web`, `packages/db`)

Architecture docs, read the one that matches your task:
- `docs/ARCHITECTURE.md`: modules and their dependencies, API routes, data model, deployment.
- `docs/SYSTEM_DESIGN.md`: how data flows (Garmin/Strava/weather ingestion, read path + SSE), with failure behaviour per flow.

## Commands

```bash
npm run dev          # turbo dev → db tsc --watch + nest --watch (3001) + vite (5173)
npm run build        # turbo build → packages/db, then apps/api + apps/web (web builds into apps/api/dist/client)
npm run start        # apps/api: NODE_ENV=production node dist/main.js
npm test             # turbo test → Jest in apps/api only (apps/web has no tests)
npm run type-check   # turbo type-check (tsc --noEmit) across all packages
npm run lint         # turbo lint (ESLint flat config, strictTypeChecked) across all packages
npm run migrate      # drizzle migrator, then the idempotent backfill-at-hike script (both run at Railway deploy)
npm run db:generate  # drizzle-kit generate → SQL in packages/db/drizzle/
npm run db:studio    # Drizzle Studio
railway config plan  # diff .railway/railway.ts against the linked Railway environment (needs the global @railway/cli)
railway config apply # apply that diff (asks for confirmation)
```

Local Postgres: `docker compose up -d` (matches `.env.example`'s `DATABASE_URL`).

## Verification

Run from the repo root before calling work done:

1. `npm run type-check`: must pass with no errors.
2. `npm run lint`: must report **0 errors**. Warnings already exist on `main` (about 90); do not add new ones in files you touch.
3. `npm test`: must pass. Only `apps/api` has a test runner (Jest + ts-jest, ESM, `*.spec.ts` under `src/`).
4. Schema changed? `npm run db:generate` and commit the generated SQL plus `meta/` snapshot.
5. UI changed? Run `npm run dev` and check the change in the browser; there are no frontend tests.

There is **no CI for code**: the only GitHub workflows are the Railway config ones (`railway-config.yml`, `railway-drift.yml`). Every push to `main` deploys straight to production, so these checks are the only gate.

## Definition of done

- The Verification steps above pass locally, and the PR body says which ones you ran.
- New API logic has a `*.spec.ts` next to the file it tests (see `hikes/hike-classifier.service.spec.ts`), testing through the service's public methods.
- Docs follow the code: the diagram rule under Key conventions, and `docs/ARCHITECTURE.md` for new modules, routes or tables.
- No new dependency, no hand-edited migration, no direct push to `main`.

## Adding a new API route

1. Create or update the relevant `apps/api/src/<module>/` directory (controller, service, module).
2. Add a DTO class in `<module>.dto.ts` with `class-validator` decorators.
3. Inject `DRIZZLE` (typed `DrizzleClient`) via `@Inject(DRIZZLE)` for DB access.
4. Guard admin routes with `@UseGuards(AdminGuard)` (`AuthModule` is global, no import needed).
5. Import the module in `apps/api/src/app.module.ts`.

## Key conventions

- **DB schema changes:** edit `packages/db/src/schema.ts` → `npm run db:generate` → commit the generated SQL. Never hand-edit migration files.
- **DB access in API:** services inject `DRIZZLE`; tables come from `import { table } from '@trackpath/db/schema'`. Only `auth.ts` imports the `db` client directly (`import { db } from '@trackpath/db'`). Never use relative paths to `packages/db`.
- **Server helpers:** add targeted query helpers (like `GarminService.getLastGarminPoint()` / `countPoints()`) instead of reusing `GarminService.getAllPoints()` for everything.
- **Hikes:** every tracking point and Strava activity is attributed to a hike by `HikeClassifierService` (device timestamp in the hike's date range, trail proximity breaks ties). Data no hike covers is discarded. Public reads default to `app_settings.default_hike_id`.
- **React state:** prefer `useMemo`/`useCallback` for expensive derivations. Use imperative handles (`useImperativeHandle`, as in `components/Map`) for cross-component calls that would otherwise cause full re-renders.
- **Modal pages** (`AdminPage`, `StatsPage`, `GearPage`, `TrailLogPage`, `PollsPage`, `ResourcesPage`, `CheersPage`) are lazy-loaded in `App.tsx`; keep them out of the initial bundle.
- **CSS:** CSS Modules per component (`ComponentName.module.css`). No global styles except `src/styles/index.css`.
- **TypeScript strictness:** never use `any` or `@ts-ignore`. If a type is missing, define it in `apps/web/src/types.ts` or infer it from the Drizzle schema.
- **Routing:** do not add new routes directly to `main.ts`. Create a NestJS module with a controller and register it in `app.module.ts`.
- **Validation:** use `class-validator` DTO classes for all request bodies. The global `ValidationPipe` (whitelist + transform) is active, so unknown fields are stripped automatically.
- **Rate limiting:** `ThrottlerGuard` is bound globally (120 req/min per IP). The manual sync endpoints (`POST /api/sync`, `POST /api/strava/sync`) add `@Throttle({ default: { ttl: 60_000, limit: 5 } })`; use the same decorator on any new sync or expensive write endpoint.
- **System design diagrams:** when changing an ingestion or data-flow module (`garmin/`, `strava/`, `hikes/`, `weather/`, `sync-periods/`, the points/activities read path, or the bundled trail JSON), update all three: `docs/SYSTEM_DESIGN.md` (overview + flow table + Garmin sequence), the identical overview Mermaid block in `README.md`, and the ASCII system diagram in `docs/ARCHITECTURE.md`. Module, route or table changes also update the module graph and ER diagram in `docs/ARCHITECTURE.md`.
- **Package management:** use standard Node/Vite/React APIs first. Ask for permission before running `npm install` for any new dependency.
- **Railway config:** change `.railway/railway.ts`, never the Railway dashboard. Secrets stay `preserve()`. PRs that touch `.railway/` touch nothing else (the PR that introduced `.railway/` is the one exception). Merging a `.railway/` PR applies it via `.github/workflows/railway-config.yml`; destructive plans are refused there and only ever applied by hand. A daily workflow fails on drift.

## Domain rules (the trail reality)
- **Spotty connectivity:** Garmin MapShare pings or user-generated logs may arrive out of order, in batches, or delayed by several days. Always rely on the device timestamp, not the server ingestion time.
- **Data integrity:** coordinate data (latitude/longitude/elevation) is the source of truth. Never mutate historical coordinate data once written.

## Environment variables

Validated at boot by `apps/api/src/config/env.schema.ts` (Zod); `.env.example` documents local values.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `BETTER_AUTH_SECRET` | Session signing secret (required, ≥ 16 chars) |
| `BETTER_AUTH_URL` | Base URL for auth callbacks; also a trusted origin |
| `TRUSTED_ORIGINS` | Extra comma-separated trusted origins for better-auth (read in `auth.ts`, not in the Zod schema) |
| `ADMIN_EMAILS` | Comma-separated admin emails; empty means no admin (fail closed) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth login; login disabled when unset |
| `MAPSHARE_ID` | Seeds `app_settings.mapshare_id` once, when `backfill-at-hike` first creates the AT hike. After that the DB value wins and changing the env var has no effect; no API route edits it yet |
| `POLL_INTERVAL_MIN` | Garmin auto-sync interval in minutes (default 5) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Strava OAuth; the daily Strava cron is skipped when unset |
| `NEST_PORT` / `PORT` | Listen port: `NEST_PORT` (local dev, default 3001) wins over `PORT` (set by Railway) |

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues in `vicodut/trackpath` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five roles map to labels of the same name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one glossary + `docs/adr/` at the project root. See `docs/agents/domain.md`.

## Agent models and specialists

- **Grilling runs on Opus 5.5** (`claude-opus-5-5`). This covers the `grilling`, `grill-with-docs` and `domain-modeling` skills, and every subagent they spawn, including fact-finding subagents. When a grilling subagent is spawned, pass `model: "opus"` (the Agent tool takes aliases only: `opus`, `sonnet`, `haiku`). Grilling runs inline in the main session, so start that session on Opus 5.5 (`/model`).
- **Implementation runs on Sonnet 5.5** (`claude-sonnet-5-5`). This covers the `implement`, `implement-spec` and `tdd` skills and every implementer, merger and exploration subagent they spawn. Pass `model: "sonnet"` to each.
- **Specialists.** During an implement run, spawn the matching project agent for a ticket's area with `subagent_type`:
  - `react-specialist` for React components, hooks, state and CSS Modules in `apps/web`.
  - `nextjs-specialist` for Next.js routing, server/client boundaries and config. This repo does not use Next.js today, so use it only if a ticket adds or targets a Next.js app.
  - Definitions live in `.claude/agents/`.
- **Code review runs on Opus 5.5.** This covers the `code-review` skill and every reviewer subagent it spawns (standards and spec reviews). When a review subagent is spawned, pass `model: "opus"`.

## Do not

- Hand-edit files in `packages/db/drizzle/`; always use `db:generate`.
- Use `getAllPoints()` for endpoints that only need a count or the latest point.
- Add `--no-verify` to git commands or skip migration on deploy.
- Import modal page components statically in `App.tsx`.
- Push directly.
- Edit Railway settings in the dashboard, inline secrets in `.railway/railway.ts`, or pass `--include-variables` / `--confirm-destructive` in automation.
- Install new npm packages, or reference ones that don't exist, without explicit permission.
- Write raw SQL queries; use the Drizzle ORM query builder or relational queries (two `sql` ordering templates remain in `polls.service.ts`, see `docs/IMPROVEMENT_SPEC.md`).
- Delete existing comments or JSDoc strings when modifying a function.
- Use relative paths across workspace boundaries; always use `@trackpath/db` imports.
