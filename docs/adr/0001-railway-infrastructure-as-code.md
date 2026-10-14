# 0001 — Railway configuration lives in `.railway/railway.ts`

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Trackpath runs on Railway as one project with a single `production` environment:
the web service (built from the root `Dockerfile`), a PostgreSQL database, a custom
domain and the environment variables listed in `CLAUDE.md`. Until now all of that was
configured by hand in the Railway dashboard — nothing in the repo described it, and the
repo never had a `railway.json` / `railway.toml`.

Railway's per-service Config as Code (`railway.json` / `railway.toml`) is deprecated
(files stop being read on 2026-12-01). Its replacement is
[Infrastructure as Code](https://docs.railway.com/infrastructure-as-code): one
project-scoped authoring file evaluated by the CLI (`railway config plan` / `apply`),
never at deploy time.

## Decision

- **Authoring:** TypeScript at `.railway/railway.ts`, using the `railway` SDK
  (`railway/iac`) pinned as a root devDependency. The CLI is installed outside the repo
  (`brew install railway`).
- **Bootstrap:** the file is generated with `railway config pull` from the live project
  and committed only once `railway config plan` reports no changes.
- **Scope:** everything `pull` emits — service, Postgres, volumes, domain, variables.
  Only `production` is managed.
- **Secrets:** stay in Railway. Secret variables are written as `preserve()`; never use
  `--include-variables`. `DATABASE_URL` is a reference to the database resource.
- **Deploy behaviour is unchanged:** the `Dockerfile` `CMD` (`npm run migrate && npm run
  start`) stays the single source of truth. The IaC file declares no start or pre-deploy
  command.
- **Applying:** manually with `railway config plan` / `railway config apply` for now. A
  follow-up adds the `railwayapp/config` GitHub Action (plan on PR, apply on merge), a
  guard that refuses destructive plans in both the plan and apply jobs, and a daily
  drift check.
- **PR isolation:** PRs that touch `.railway/` touch nothing else, so a config apply and
  a code deploy triggered by the same merge never race.

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
