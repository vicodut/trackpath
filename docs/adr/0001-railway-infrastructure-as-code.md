# 0001 — Railway configuration lives in `.railway/railway.ts`

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Trackpath runs in the Railway project `stunning-manifestation` (`production`
environment): the `trackpath` service (custom domain `vico.camp`), the `Postgres` database
with its `postgres-volume`, and the environment variables listed in `CLAUDE.md`. The same
project also hosts unrelated apps (calibre-wa, ghost, MySQL, livetrack2, bridgeStatus). Until now all of that was
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
  deletes resources it owns, are left alone. The first `railway config apply` claims
  ownership. Only `production` is managed. Variables on owned services are managed by
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

## Known drift to fix in a follow-up

The imported `trackpath` service still has `builder: "RAILPACK"` and
`watchPatterns: ["/trackpath/**"]`, left over from before the app moved to the repo root.
Because of the watch pattern, merges to `main` are currently **skipped** instead of
deployed (e.g. PR #4). The `RAILPACK` builder also contradicts the docs, which say the
app deploys through the root `Dockerfile`. The `Postgres` TCP proxy
(`tcpProxies: { "5432": {} }`) exposes the database publicly. All of this was committed
as-is so the first commit plans to zero changes; a separate `.railway/`-only PR corrects
it, and that PR changes deploy behaviour.

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
