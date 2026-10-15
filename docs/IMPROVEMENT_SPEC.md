# Trackpath — Codebase Improvement Spec

**Status:** Proposal — no code changed by this document.
**Scope:** Full monorepo (`apps/api`, `apps/web`, `packages/db`) plus third-party dependencies.
**Method:** Direct code review + `npm audit` / `npm outdated` against the real repo, cross-checked with two independent module sweeps (backend modules not previously touched, and frontend structure). Every finding below cites `file:line` and was verified, not guessed.

---

## 1. Executive summary — fix these five first

| # | Finding | Why it matters | Effort |
|---|---|---|---|
| 1 | `better-auth@1.5.6` has **5 open advisories, one rated critical** (account takeover via OAuth auto-link, pre-account hijacking, stale sessions after user deletion) | Auth is the trust boundary for every admin write endpoint in the app | Upgrade to `1.7.1+`, ~1–2h incl. regression pass |
| 2 | Rate limiting is **completely inert** — `ThrottlerGuard` is never bound anywhere (no `APP_GUARD`, no `@UseGuards`) | Every `@Throttle()` decorator in `garmin.controller.ts` / `strava.controller.ts` does nothing; sync endpoints and public write endpoints (cheers, poll suggestions) have no real limit beyond nothing | 15 min |
| 3 | Root `eslint.config.js` **cannot load at all** (`Cannot use import statement outside a module`) — confirmed by running `npm run lint` | Lint has not run successfully once in this repo's current state; nobody would notice a lint regression | 1 line: add `"type": "module"` to root `package.json`, or rename to `eslint.config.mjs` |
| 4 | `apps/web` fails `tsc --noEmit` right now (`App.tsx:83` unsound cast + 3 unused-declaration errors) and `apps/api` fails too (`cheers.dto.ts:4-5`) | Both workspaces' `type-check` script is red on `main` today — CLAUDE.md's own "never `any`/`@ts-ignore`" bar is already broken in one spot | 30 min |
| 5 | Zero automated tests anywhere, and **no CI** (`.github/` doesn't exist) | Every fix in this doc (and every future change) is verified by hand only; nothing stops a regression from reaching Railway | Medium — see §6 |

---

## 2. Security & data integrity

### 2.1 `better-auth` critical CVE — **P0**
`npm audit --omit=dev` reports `better-auth <=1.7.0-rc.6` (installed: `1.5.6`) as **critical**, with these advisories directly relevant to an app that gates writes on `session.user.email`:

- `GHSA-g38m-r43w-p2q7` — account takeover via OAuth auto-link to an unverified pre-registered email
- `GHSA-qq9h-g4jm-xgf3` — account takeover via pre-account hijacking on magic-link/email-OTP
- `GHSA-2vg6-77g8-24mp` — stale sessions persist after user deletion
- `GHSA-wxw3-q3m9-c3jr` — OAuth callback accepts mismatched `state` without PKCE
- Plus 6 more (refresh-token replay/forking, insecure oidc defaults, stored XSS via `redirect_uri`)

**Proposal:** bump to `^1.7.1` (current `latest`), re-verify the GitHub OAuth flow and `AdminGuard`'s email-allowlist check end-to-end (`apps/api/src/auth/auth.service.ts`, `admin.guard.ts`).

### 2.2 Rate limiting does not exist — **P0**
`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])` is registered in `app.module.ts:23`, and `@Throttle({...})` decorates `garmin.controller.ts:40` and `strava.controller.ts:60`. But `@nestjs/throttler` requires `ThrottlerGuard` to be bound — either globally via `APP_GUARD` or per-controller via `@UseGuards(ThrottlerGuard)` — for any of this to take effect. Grepped every `*.module.ts` in the repo: **no `APP_GUARD` provider, no `@UseGuards(ThrottlerGuard)` anywhere.** The decorators are inert. This directly contradicts the "Rate limiting" line in `CLAUDE.md`.

**Proposal:** add to `app.module.ts`:
```ts
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
```
Then re-verify the tighter per-route limits on `garmin.controller.ts:40`, `strava.controller.ts:60` actually return `429` under load (a quick `ab`/`autocannon` smoke test would confirm).

### 2.3 Hardcoded fallback credential in source — **resolved**
**Resolved:** the Ghost blog integration that carried a hardcoded fallback URL and Content API key was removed entirely, and the Ghost service was deleted on Railway (2026-10-14), so the key is dead.

### 2.4 Unvalidated bulk-import endpoint — **P1**
`gear.controller.ts:87` — `importItems(@Body() rows: ImportRowDto[])` takes a bare array body. NestJS's `ValidationPipe` does not validate array-typed bodies (only object metatypes), so `ImportRowDto`'s `class-validator` decorators never run despite being fully annotated. There's already an unused `ImportItemsDto` (wraps `rows` in `@ValidateNested`) in `gear.dto.ts:143-148` that looks like an abandoned fix.

**Proposal:** change the controller signature to accept `ImportItemsDto` (`{ rows: ImportRowDto[] }`) instead of a bare array, per NestJS's documented pattern for validating array bodies.

### 2.5 Poll double-voting race — **P2**
`polls.service.ts:62-79` does check-then-insert (select existing vote by `pollId + ipAddress`, then insert) with no unique constraint on `poll_votes (poll_id, ip_address)` in `schema.ts:128-134`. Two concurrent requests from the same IP can both pass the check and both insert.

**Proposal:** add a unique index on `(pollId, ipAddress)` in `schema.ts`, `db:generate`, and let the DB reject the race instead of the app trying to prevent it.

### 2.6 No security headers / CORS policy — **P2**
`main.ts` never calls `app.enableCors()` or installs `helmet`. `compression` is a declared dependency (`apps/api/package.json`) but is never imported or used anywhere — likely intended to be wired in and forgotten.

**Proposal:** add `helmet()` (CSP, `X-Frame-Options`, etc.) and either use `compression()` or drop the unused dependency.

### 2.7 `stravaActivities.startDate` is `text`, not `timestamp` — **P2**
Same anti-pattern class as the `trackingPoints.timestamp` bug fixed this session (`packages/db/src/schema.ts:80`). It happens to be safe today because Strava's API already returns zero-padded ISO8601, but there's no type-level guarantee, no efficient range queries, and it's one bad write away from silently breaking `ORDER BY`/comparisons again exactly like `trackingPoints` did.

**Proposal:** migrate to `timestamp with time zone`, same custom-migration pattern used in `0006_fix_garmin_timestamp_format.sql`.

### 2.8 Missing indexes on foreign-key columns — **P2**
Postgres does not auto-index FK columns. `gearItems.categoryId` (`schema.ts:98`), `pollOptions.pollId` (`schema.ts:123`), `pollVotes.pollId`/`optionId` (`schema.ts:130-131`) are all filtered/joined on every request (`gear.service.ts`, `polls.service.ts:130-145`) with no index.

**Proposal:** add `index()` entries for these columns in the next schema migration.

---

## 3. Dependency / library audit

### 3.1 Vulnerable dependencies (`npm audit`)

| Package | Installed | Fixed in | Severity | Where used |
|---|---|---|---|---|
| `better-auth` | 1.5.6 | 1.7.1 | **Critical** | `apps/api` — auth |
| `dompurify` | 3.4.12 | 3.4.14 | Moderate | `apps/web` — Blog HTML sanitization (`BlogPost.tsx:61`) |
| `drizzle-kit` (dev, via `@esbuild-kit/*`) | pinned range 0.19–1.0-beta | update chain | Moderate (dev-only, dev-server request forgery) | `packages/db` — schema generation tool, not shipped to prod |

`npm audit fix` resolves `dompurify` and (partially) the `drizzle-kit`/`esbuild` chain without breaking changes. `better-auth` needs a manual bump + smoke test since it's a minor version jump with breaking-change potential in OAuth flows.

### 3.2 Version drift (`npm outdated`, non-security)

Nothing urgent, but notable gaps as of this review:

| Package | Current | Latest | Note |
|---|---|---|---|
| `better-auth` | 1.5.6 | 1.7.1 | see §3.1 |
| `chokidar` (transitive, via `@swc/cli`) | pinned 3.6.0 | 5.0.0 | See §5.2 — pinned as an ESM-compat workaround, not a real fix |
| `eslint` | 9.39.4 | 10.8.1 | Major version behind; irrelevant until §1 item 3 is fixed and lint actually runs |
| `zod` | 4.3.6 | 4.4.3 | Minor lag |
| `@nestjs/*` family | 11.1.x | 11.2.1 | Minor lag, low risk |
| `typescript` | 6.0.2 | 6.0.3 | Patch lag |
| `react` / `react-dom` | 19.2.4 | 19.2.8 | Patch lag |
| `vite` | 8.1.5 | 8.2.2 | Minor lag |

**Proposal:** routine `npm update` within semver ranges after §1/§3.1 land; no need for a dedicated effort beyond that.

### 3.3 Library-usage findings (not version issues)

- **`@nestjs/throttler` is installed and imported but its guard is never wired up** (§2.2) — this is the single highest-value fix in the whole audit relative to effort.
- **`@nestjs/config` is dead weight at runtime.** `ConfigModule` validates env vars with a Zod schema at boot (good), but `ConfigService` is never injected anywhere in `apps/api/src` — every consumer (e.g. `auth.service.ts`, `strava.service.ts`) reads raw `process.env.X` directly instead. The validated/typed values the Zod schema produces are never actually used, so a typo'd env var is only caught if it happens to match a pattern the Zod schema checks, not for any value read outside `config.module.ts` itself.
  **Proposal:** either inject `ConfigService` everywhere env vars are read, or drop `@nestjs/config` + Zod and keep the validation as a single fail-fast boot check that populates a typed `AppConfig` object services import directly — pick one, not both.
- **Two validation paradigms in one backend:** `zod` for env vars, `class-validator`/`class-transformer` for DTOs. Not wrong (they solve different problems), but worth being deliberate about — if `@nestjs/config` is dropped per above, Zod's footprint shrinks to just `env.schema.ts`.
- **`tsx` is listed as a production `dependency` of `apps/api`** (`apps/api/package.json`) but is never imported anywhere in `apps/api/src` — it's only used by `packages/db`'s migration script. Move it to `apps/api`'s `devDependencies` or remove it; it's shipping into the production Docker image for no reason.
- **`SQL_CLIENT` / `sqlClientProvider`** (`database/sql-client.provider.ts`) is exported but never `@Inject()`-ed anywhere — a raw-postgres escape hatch that's dead code today. Either remove it or document why it's kept for future use.
- **`chokidar` pinned to `^3.6.0`** in `apps/api/package.json` (currently an uncommitted local change) works around `@swc/cli`'s optional dependency on `chokidar`, whose v5 is ESM-only and breaks `require()` inside `@swc/cli`'s CJS loader — confirmed by running `npm run dev` in this session (`nest start --watch` throws `require() of ES Module ... not supported`). The pin is a real, working fix for local dev, but it's silently reverting a bump someone made intentionally; worth a comment in `package.json` explaining why, and tracking the upstream `@swc/cli` fix so the pin can be removed later.

---

## 4. Backend architecture & consistency

| Finding | File:line | Severity |
|---|---|---|
| Weather external-API error handling is weak — `weather.service.ts:56-57` has no try/catch and never checks `res.ok`, so a network blip becomes an unhandled 500 with a stack leak | `weather/weather.service.ts:56-57` | Medium |
| `gear.service.ts` update/delete methods don't check affected-row count — acting on a nonexistent id returns `200 {ok:true}` instead of `404`, unlike `polls.service.ts:82-89`'s `close()` which correctly throws `NotFoundException` | `gear/gear.service.ts:49-59,84-99` | Low-Medium |
| Raw `sql\`...DESC\`` template used for ordering instead of Drizzle's `desc()` helper (the established convention elsewhere, e.g. `cheers.service.ts:17`) — minor violation of the "no raw SQL" rule in `CLAUDE.md` | `polls/polls.service.ts:40,109` | Low |
| `weather` controller calls an external API but has no `@Throttle()`, unlike comparable `garmin`/`strava` sync endpoints (moot until §2.2 lands, but worth doing together) | `weather/weather.controller.ts:8-11` | Low (blocked on §2.2) |
| `cheers.dto.ts` fails `tsc --noEmit` today: `name`/`message` have no initializer under `strict`'s definite-assignment check | `cheers/cheers.dto.ts:4-5` | High (build-breaking) |

**Proposed fix for the `cheers.dto.ts` build break** (smallest possible patch):
```ts
export class CreateCheerDto {
  @IsString() name!: string;
  @IsString() message!: string;
}
```
(add the `!` definite-assignment assertions, matching the pattern already used elsewhere in the codebase's DTOs)

---

## 5. Frontend architecture & consistency

### 5.1 Distance-constant disagreement — **P1, correctness bug**
Three different numbers represent "distance to Katahdin / full AT length," and they don't agree:

- `components/Stats/index.tsx:7` — `KATAHDIN_KM = 3119`
- `data/iconic-summits.ts:22` — `distanceKm: 3119` (consistent with the above)
- `components/StatsPage/index.tsx:631` — `AT_FULL_KM_MORDOR = 3524` (~400km different, same real-world quantity)

The compact `Stats` sidebar widget and the full `StatsPage` "Road to Mordor" section will report different "% to Katahdin" for the same underlying distance.

**Proposal:** pick one authoritative AT-length constant (real official distance is commonly cited around 3,529 km / 2,193 mi, though it shifts slightly year to year with reroutes), define it once in `lib/constants.ts`, and import it everywhere instead of three independent literals.

### 5.2 No test coverage, anywhere
Confirmed zero `*.test.ts(x)` / `*.spec.ts` files in `apps/web`, and no testing library installed (no `vitest`, `@testing-library/react`, `jsdom`, `playwright`). On the backend, `jest`/`ts-jest`/`supertest` are fully configured in `apps/api/package.json` but there are also zero `*.spec.ts` files — the test *infrastructure* exists and is completely unused. See §6.

### 5.3 Duplicated logic
- `p.garminId?.startsWith('manual-')` is repeated identically in **9+ files**: `App.tsx:135,158,184`, `Sidebar/index.tsx:352`, `Map/index.tsx:410,612`, `LocationBanner/index.tsx:25`, `StatsPage/index.tsx:1280` (pre-existing occurrence, unrelated to this session's edits), `TrailLogPage/index.tsx:53`, `Stats/index.tsx:24`, `usePoints.ts:116`.
  **Proposal:** one `isManualPoint(p: TrackingPoint)` helper in `lib/`.
- Unit-conversion constant `0.621371` (km→mile) duplicated in `ResourcesPage/index.tsx:8` and `hooks/useUnit.ts:26`.

### 5.4 Type-check is currently red
`npx tsc --noEmit -p apps/web/tsconfig.json` fails today with:
- `App.tsx:83` — unsound double-cast `(DeviceMotionEvent as {...}).requestPermission` (`TS2352`) — exactly the kind of cast `CLAUDE.md`'s "never `any`" rule exists to prevent, even though it's not literally `any`.
- `GearPage/index.tsx:315` — unused `updateCategory` (`TS6133`)
- `Map/index.tsx:17` — unused `useIsMobile` import (`TS6133`)
- `Map/index.tsx:368` — unused `onPointTap` prop (`TS6133`)

All four are pre-existing (not introduced this session) but block a clean `npm run type-check` on `main` right now.

### 5.5 Fetch calls bypass the `api/` wrapper layer
10+ components call `fetch()` directly instead of going through `apps/web/src/api/*`, with inconsistent `res.ok` handling: `HighlightsLayer/index.tsx:75`, `Blog/BlogPost.tsx:24`, `Blog/BlogList.tsx:86,89`, `AdminPage/index.tsx:52`, `Weather/index.tsx:35`, `StatsPage/index.tsx:160,291`, `useAdmin.ts:10`, `useTrailDistance.ts:32,36`, `Map/index.tsx:111`, `MapElevationProfile/index.tsx:107`, `useStrava.ts:16,20,28,42`. Most skip checking `res.ok` before `.json()`.

**Proposal:** not necessarily move every call into `api/`, but standardize on a shared `fetchJson()` helper that checks `res.ok` and throws a consistent error, so failures don't silently parse an HTML error page as JSON.

### 5.6 Accessibility gaps
`aria-label` appears in only 1 of 28 component files (`Header/index.tsx`). `AdminPage/index.tsx` (12 buttons) and `Sidebar/index.tsx` (14 buttons) are essentially unlabeled, several icon-only (e.g. `GearPage/index.tsx:74`'s ✓/✕ confirm buttons). None of the page-level "modal" components (AdminPage, StatsPage, GearPage, CheersPage, PollsPage, TrailLogPage) trap focus or close on <kbd>Escape</kbd> — keyboard users can tab out into background content.

**Proposal:** a small shared `useModalA11y()` hook (Escape-to-close + focus trap) applied to all seven lazy-loaded page components would fix this in one place instead of seven.

### 5.7 Minor: heavy inline `style={{}}` usage
`GearPage/index.tsx` (29 occurrences), `StatsPage/index.tsx` (23), `MapElevationProfile/index.tsx` (13) mix inline styles with CSS Modules, fragmenting the project's stated CSS convention. Not urgent, but worth folding into module CSS opportunistically when touching those files.

---

## 6. Testing & CI/CD — the biggest structural gap

Currently:
- **No `.github/` directory** — nothing runs on push or PR. The only gate before Railway deploys is the Dockerfile's `npm run build`, which would only catch a TypeScript compile error, not a lint issue, not a logic regression, not a test failure (there are no tests to fail).
- **Backend**: `jest`/`ts-jest`/`@nestjs/testing`/`supertest` are fully installed and a `test` script exists, but zero `*.spec.ts` files exist.
- **Frontend**: no test tooling installed at all.

**Proposed minimum viable setup** (roughly in priority order):

1. **CI workflow** (`.github/workflows/ci.yml`): on every push/PR, run `npm run type-check`, `npm run lint` (once §1 item 3 is fixed), and `npm run build` across the turbo pipeline. This alone would have caught every red type-check finding in this doc automatically.
2. **Backend smoke tests**: a handful of `supertest`-based tests against the already-installed `@nestjs/testing` setup — start with `AdminGuard` (the security-critical path: verify non-admin emails are rejected) and the Garmin timestamp parser (`parseGarminTimeUtc`) added this session, since it has clear input/output pairs and just fixed a real production data bug.
3. **Frontend**: add `vitest` + `@testing-library/react` (Vite-native, minimal config). Start with the `lib/` pure functions (`haversine`, unit conversion) and the distance/elevation `useMemo` logic in `usePoints.ts`, since those are pure and currently duplicated (§5.3) — tests would also make deduplication safe.

---

## 7. Prioritized backlog

| Priority | Item | Section | Est. effort |
|---|---|---|---|
| P0 | Upgrade `better-auth` to 1.7.1+ | §2.1 | 1-2h |
| P0 | Bind `ThrottlerGuard` globally | §2.2 | 15min |
| P0 | Fix `eslint.config.js` module-loading break | §1.3 | 5min |
| P0 | Fix `cheers.dto.ts` build-breaking TS error | §4 | 5min |
| P1 | Fix `App.tsx:83` unsound cast + 3 unused-decl errors | §5.4 | 30min |
| P1 | Fix gear bulk-import validation bypass | §2.4 | 30min |
| ~~P1~~ | ~~Remove hardcoded Ghost fallback credential~~ (done) | §2.3 | — |
| P1 | Reconcile Katahdin/AT-length constants | §5.1 | 20min |
| P2 | `npm audit fix` (dompurify, drizzle-kit chain) | §3.1 | 10min |
| P2 | Unique index on `poll_votes(poll_id, ip_address)` | §2.5 | 30min (+migration) |
| P2 | Add `helmet()`, wire up or drop `compression` | §2.6 | 30min |
| P2 | Migrate `stravaActivities.startDate` to `timestamp` | §2.7 | 1h (+migration, mirrors §0006) |
| P2 | Index FK columns (gear, poll tables) | §2.8 | 30min (+migration) |
| P3 | Dedupe `isManualPoint()` helper | §5.3 | 20min |
| P3 | Standardize fetch error handling on frontend | §5.5 | 1-2h |
| P3 | Basic focus-trap/Escape hook for modal pages | §5.6 | 1-2h |
| Structural | CI workflow (type-check + lint + build) | §6 | 1h |
| Structural | Backend smoke tests (AdminGuard, timestamp parser) | §6 | half day |
| Structural | Frontend `vitest` setup + `lib/` unit tests | §6 | half day |

---

*Everything above was verified against the live repo state (git HEAD at time of writing) via direct code review, `tsc --noEmit`, `npm run lint`, `npm audit`, and `npm outdated` — not inferred from documentation alone.*
