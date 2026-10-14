# 0001 — Railway configuration lives in `.railway/railway.ts`

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Trackpath runs in the Railway project `stunning-manifestation` (`production`
environment): the `trackpath` service (custom domain `vico.camp`), the `Postgres` database
with its `postgres-volume`, and the environment variables listed in `CLAUDE.md`. The same
project also hosts unrelated apps (calibre-wa, livetrack2, bridgeStatus); the dead
Ghost blog and its MySQL database were deleted on 2026-10-14. Until now all of that was
configured by hand in the Railway dashboard — nothing in the repo described it, and the
repo never had a `railway.json` / `railway.toml`.

Railway's per-service Config as Code (`railway.json` / `railway.toml`) is deprecated
(files stop being read on 2026-12-01). Its replacement is
[Infrastructure as Code](https://docs.railway.com/infrastructure-as-code): one
project-scoped authoring file evaluated by the CLI (`railway config plan` / `apply`),
never at deploy time.

## Decision

- **Authoring:** TypeScript at `.railway/railway.ts`, using the `railway` SDK
  (`railway/iac`) as a root devDependency. The CLI is installed outside the repo
  (`npm i -g @railway/cli`; Homebrew has no working build for Intel macOS 26).
- **Bootstrap:** the file is generated with `railway config pull` from the live project
  and committed only once `railway config plan` reports no changes.
- **Scope:** the file exports the named partial `trackpath` and declares only
  trackpath's resources: the `trackpath` service, `Postgres` and `postgres-volume`.
  The other apps in the project are not declared and, because a named partial only
  deletes resources it owns, are left alone. Ownership is claimed by the first
  `railway config apply` that actually changes something: an apply with nothing to change
  exits early without recording ownership (observed 2026-10-14). Only `production` is managed. Variables on owned services are managed by
  the file (the CLI default).
- **Secrets:** stay in Railway. Secret variables are written as `preserve()`; never use
  `--include-variables`. `DATABASE_URL` is a reference to the database resource
  (`Postgres.env.DATABASE_URL`).
- **Deploy behaviour is unchanged:** the `Dockerfile` `CMD` (`npm run migrate && npm run
  start`) stays the single source of truth. The IaC file declares no start or pre-deploy
  command.
- **Applying:** manually with `railway config plan` / `railway config apply` for now. A
  follow-up adds the `railwayapp/config` GitHub Action (plan on PR, apply on merge), a
  guard that refuses destructive plans in both the plan and apply jobs, and a daily
  drift check.
- **PR isolation:** PRs that touch `.railway/` touch nothing else, so a config apply and
  a code deploy triggered by the same merge never race.

## Drift found at import (fixed 2026-10-14, #6 and #7)

The imported `trackpath` service had `builder: "RAILPACK"` and
`watchPatterns: ["/trackpath/**"]`, left over from before the app moved to the repo root.
The watch pattern matched nothing, so merges to `main` were **skipped** instead of
deployed (e.g. #4, #5). `Postgres` also had a public TCP proxy on 5432. These were
committed as pulled so the first commit planned to zero changes, then fixed in
`.railway/`-only follow-ups: the builder is now `DOCKERFILE`, there are no watch patterns,
and the proxy is removed.

Authoring gotchas learned on the way:
- An empty `tcpProxies: {}` does not remove a proxy; write `{ "5432": null }`.
- `watchPatterns: []` is stored as `null` and shows as a perpetual change; omit the key.

`calibre-wa` still builds from this repo's deleted `/calibre-wa` directory, so its deploys
fail on every push to `main` (the last good build keeps serving `books.vico.camp`). It is
not declared here; giving it its own repo is tracked separately.

This PR (the one introducing `.railway/`) is the only exception to the PR-isolation rule.

## Consequences

- Railway settings must no longer be edited in the dashboard; change the file and
  apply it instead. Dashboard edits show up as drift and would be reverted by the next
  apply.
- Destructive changes (removing the database, a volume or a service) are never applied
  automatically. GitHub Free cannot enforce required checks on this private repo, so the
  guard lives inside the apply job itself; destructive changes are applied by hand from
  the CLI.
- Hike history in Postgres is protected from config mistakes by that guard, in line with
  the rule that historical coordinate data is never mutated.
