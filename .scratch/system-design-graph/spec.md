# System design graph

Status: ready-for-agent

## Problem Statement

TrackPath is about to become a public repository, and people reviewing the owner's GitHub profile will land on it with no guided way to understand how the system works. The only architecture picture today is an ASCII box diagram in the architecture doc showing SPA → NestJS → Postgres / Garmin / Strava. It is shallow, it omits Open-Meteo, the hike classifier, and the bundled static trail data, and it says nothing about how data actually moves through the system. A reviewer has to read the code to figure out how a GPS ping from the trail ends up on the map.

## Solution

Add a hand-maintained system design document, written in Markdown with Mermaid diagrams that GitHub renders natively, describing TrackPath at the data-flow level. It has two layers in one file: a public overview diagram that tells the story at a glance, and a "for developers" section with a per-flow reference table and a Garmin ingestion sequence diagram. The README embeds the overview diagram so reviewers see it immediately, and links to the full document. The existing ASCII diagram stays, slimmed to a system-level view (with Open-Meteo added) that links to the new document. A project convention keeps all three in sync whenever ingestion or data-flow code changes.

## User Stories

1. As a GitHub reviewer, I want to see a system diagram on the repository's README, so that I understand what TrackPath does architecturally without opening any other file.
2. As a GitHub reviewer, I want the README diagram to render natively on github.com, so that I don't need to install tools or open an external site.
3. As a GitHub reviewer, I want the diagram to be readable in both GitHub's light and dark themes, so that it looks deliberate regardless of my settings.
4. As a GitHub reviewer, I want a link from the README to a fuller system design document, so that I can dig deeper if the overview interests me.
5. As a GitHub reviewer, I want the overview to group components into External services, the Railway-hosted backend, and the Browser, so that I can see deployment boundaries at a glance.
6. As a GitHub reviewer, I want to see that tracking data comes from two sources (Garmin inReach MapShare and Strava), so that I understand the system integrates multiple real-world feeds.
7. As a GitHub reviewer, I want to see that both ingestion sources converge on a shared hike classifier before reaching the points store, so that I understand the design isn't two duplicated pipelines.
8. As a GitHub reviewer, I want to see how the browser reads tracking data back (Postgres → API → SPA), so that I understand the read path.
9. As a GitHub reviewer, I want to see that weather comes from Open-Meteo through a server-side cache, so that I understand the system avoids hammering a third-party API.
10. As a GitHub reviewer, I want to see that trail highlights and elevation are static bundled data served to the SPA, so that I understand which data is live and which is precomputed.
11. As a GitHub reviewer, I want the overview to show only the important flows, without CRUD features like cheers, polls, gear, or auth, so that the story stays legible.
12. As a developer, I want a "for developers" section below the overview in the same document, so that the deeper detail lives in one place without cluttering the public story.
13. As a developer, I want a reference table covering each flow (Garmin, Strava, read path, weather, static trail data), so that I can quickly look up how each one behaves.
14. As a developer, I want each table row to state the trigger and cadence (e.g. poll interval, cron schedule, cache TTL, on-request), so that I know when each flow runs.
15. As a developer, I want each table row to name the code entry point, so that I can jump straight to the implementation.
16. As a developer, I want each table row to list the tables it reads or writes, so that I understand each flow's data footprint.
17. As a developer, I want each table row to describe the failure behaviour (what happens when the upstream is down, returns garbage, or times out), so that I know what users see when things break.
18. As a developer, I want a sequence diagram of the Garmin ingestion flow (poll → fetch KML → parse → dedupe → classify into a hike → insert), so that I understand the most intricate path step by step.
19. As the repo owner, I want the developer section to reference environment variables by name only, never by value, so that publishing the repo leaks nothing.
20. As the repo owner, I want no MapShare ID, admin emails, secrets, or URLs with credentials anywhere in the new docs, so that the public repo is safe.
21. As a developer, I want the existing ASCII diagram in the architecture doc to remain but be reduced to system-level boxes, so that the architecture doc stays self-contained without duplicating the flow detail.
22. As a developer, I want the ASCII diagram to include Open-Meteo, so that it is no longer missing an external dependency.
23. As a developer, I want the architecture doc to link to the system design document, so that readers find the detailed flow view.
24. As the repo owner, I want a rule in the project's agent guide requiring updates to the system design doc, the README overview, and the ASCII diagram whenever ingestion or data-flow code changes, so that the diagrams don't silently go stale.
25. As an AI agent working in the repo, I want that rule to name all three files explicitly, so that I know exactly what to update.
26. As the repo owner, I want the README overview and the system design overview to be the identical Mermaid block, so that there is one canonical overview and copying it is mechanical.
27. As a GitHub reviewer, I want diagrams that use default Mermaid styling, so that they don't break or look garish under GitHub's theming.
28. As a developer, I want every node, edge, and table fact to be verifiably true against the current code, so that the doc can be trusted.

## Implementation Decisions

- **Format:** Markdown with fenced `mermaid` blocks, rendered natively by GitHub. No GitHub Pages, no generated diagrams, no build step, no new dependencies.
- **Maintenance model:** hand-written and hand-maintained. Generating the diagram from code was explicitly rejected as too much effort for roughly ten rarely-changing nodes.
- **Level of detail:** data flow. Not module-dependency level, not a bare system level (the ASCII diagram keeps that role).
- **Flows in scope:**
  1. Garmin MapShare KML poll → Garmin service → hike classifier → points
  2. Strava (OAuth connection, scheduled daily sync, manual sync) → Strava service → hike classifier → points
  3. Read path: Postgres → `/api/*` → SPA
  4. Weather: Open-Meteo → server-side 30-minute cache → SPA
  5. Static trail data: bundled highlights and elevation JSON → SPA
- **Deliberately excluded from the graph:** cheers, polls, gear, auth (GitHub OAuth via better-auth), manual point entry, and the deploy pipeline.
- **Domain-rule annotations** (out-of-order pings, device timestamps, coordinate immutability) are deliberately *not* drawn on edges, to keep the diagram clean.
- **Overview diagram:** a single left-to-right flowchart with three subgraphs (External: Garmin MapShare, Strava, Open-Meteo, static trail JSON; Railway: NestJS API, Postgres; Browser: React SPA). Default Mermaid styling, no custom colours or themes.
- **Developer section:**
  - One table, one row per in-scope flow, with columns for trigger and cadence, code entry point, tables read or written, and failure behaviour.
  - A Mermaid sequence diagram for Garmin ingestion only.
  - All facts (cron times, TTLs, dedupe logic, failure handling) are taken from the code at implementation time, not from memory or existing docs.
  - Environment variables by name only.
- **Documents touched:**
  - New system design document under docs: overview plus developer section.
  - README: embeds the identical overview Mermaid block and links to the system design document.
  - Architecture doc: the ASCII diagram stays, reduced to system level, gains Open-Meteo, and links to the system design document.
  - Project agent guide: a new rule that any change to an ingestion or data-flow module must update all three of the above.
- **Delivery:** committed on the `System-design-graph` branch; the owner pushes or explicitly authorizes a push and PR against `main`.

## Testing Decisions

- **One seam: the documents as GitHub renders them.** There is no runtime code in this feature, so there are no unit or integration tests. The repo also has no CI and no Mermaid tooling, and none will be added.
- **Render check:** view every Mermaid block in GitHub's Markdown preview (the PR's rich diff or the file view on the branch) in both light and dark themes. Every diagram must render without a syntax error and with no overlapping or unreadable labels.
- **Factual audit:** every node, edge, and table cell is checked against the code. Each claim should trace to a specific service, cron decorator, cache constant, or schema table. A good check verifies observable behaviour (what triggers a flow, what it writes, what happens on failure), not internal naming trivia.
- **Leak check:** grep the new and modified docs for anything that looks like a secret, ID, email, or credentialed URL before committing.
- **Sync check:** the README overview block and the system design overview block are byte-identical.
- **Prior art:** none for docs. The existing spec files (hike classifier, health controller) are unaffected and should still pass, since no code changes.

## Out of Scope

- Making the repository public (the owner flips visibility separately).
- The git-history secret scan, which is a separate task before going public. Any real secret found will be rotated, with no history rewrite.
- Live or health-status overlays (last ping, sync status, DB health) and any in-app rendering of the graph.
- GitHub Pages, a separate public repo, or any hosting beyond github.com Markdown rendering.
- Auto-generating diagrams from code, and CI checks for diagram drift.
- Module-dependency diagrams, and diagrams for cheers, polls, gear, auth, manual points, or deploy.
- Annotating the domain rules on the diagram.

## Further Notes

- The architecture doc's ASCII diagram and the new Mermaid overview overlap on purpose. They serve different depths, and the agent-guide rule is the only thing preventing drift, so the rule's wording matters: it must name all three files.
- Strava was initially left off the flow list during the design discussion and then deliberately added back, because it feeds the same classifier pipeline as Garmin and omitting it would misrepresent the system.
