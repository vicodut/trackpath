# Multi-hike support

Status: ready-for-agent

## Problem Statement

TrackPath currently models exactly one hike: the Appalachian Trail. Its trail line, elevation profile, and points of interest are static bundled files; Garmin and Strava ingestion assume a single global trip window; and gear, blog, polls, and cheers are each one global list. The owner wants to hike the West Coast Trail next, and expects to add further hikes after that, but the app has no concept of "a hike" as a distinct thing at all — adding a second trip today would mean hacking around assumptions baked in for the first one, or duplicating the app entirely.

## Solution

Turn TrackPath into a generalized multi-hike platform. Introduce "hike" as the organizing entity for trail geometry, tracking data, gear, journal entries, and community features. An admin creates a new hike by uploading a GPX file plus basic metadata; the app derives the trail line, elevation profile, and distance automatically, and seeds points of interest from the GPX's waypoints. Garmin and Strava stay configured once, globally; every incoming tracking point or activity is automatically attributed to the correct hike based on its timestamp falling inside that hike's date range, with trail-geometry proximity used to break ties when hikes' ranges overlap. Visitors land on whichever hike is currently marked "default" at the root URL, or can browse any hike — past, current, or upcoming — explicitly. The existing Appalachian Trail data is migrated into this model as the platform's first hike, so nothing about the current experience breaks.

## User Stories

1. As a site visitor, I want to see the map/live tracking for the "default" hike when I visit the root URL, so that I land on the currently relevant trip without needing to know its name.
2. As a site visitor, I want to browse a list of all hikes (past, current, and upcoming) at an index page, so that I can find and follow any trip, not just the current one.
3. As a site visitor, I want to view any specific hike directly via a stable URL keyed by its slug, so that I can bookmark or share a link to a particular trip regardless of which one is currently "default."
4. As a site visitor, I want each hike's map to show only that hike's trail line, elevation profile, and tracking points, so that I don't see data from unrelated trips mixed in.
5. As a site visitor, I want to see hike-specific highlights/points of interest on the map, so that I understand notable landmarks for that specific trail.
6. As a site visitor, I want to read a unified blog/journal feed spanning all hikes, filterable by hike, so that I can follow the hiker's story continuously or focus on one trip.
7. As a site visitor, I want to view a gear list specific to each hike, so that I see the packing list relevant to that particular trail's conditions.
8. As a site visitor, I want to vote in and view polls/cheers scoped to the hike I'm viewing, so that engagement feels relevant to that trip rather than mixed with others.
9. As a site visitor, I want to toggle between metric and imperial units anywhere in the app, so that I can view distances, elevation, and gear weights in the system I'm most comfortable with.
10. As a site visitor, I want my unit preference to persist across visits, so that I don't have to reselect it every time.
11. As a site visitor, I want a hike that hasn't started yet to be visible (with its planned route/highlights) but without live tracking data, so that I can see what's coming up.
12. As a site visitor, I want stats (distance covered, elevation gained, etc.) calculated per-hike, so that figures aren't inflated or confused by mixing data from multiple trips.
13. As a site visitor, I want live-tracking UI (e.g. a "last known location" banner) to only appear for a hike currently within its active date range, so that finished or future hikes aren't shown with misleading "live" indicators.
14. As the site admin, I want to create a new hike by uploading a GPX file along with a name, slug, description, and start/end dates, so that I can add a new trip without writing code or redeploying.
15. As the site admin, I want the trail line, elevation profile, and total distance to be automatically derived from the uploaded GPX, so that I don't have to manually calculate or hand-enter that data.
16. As the site admin, I want points of interest to be pre-populated from any waypoints in the uploaded GPX, so that I have a head start rather than entering them all manually.
17. As the site admin, I want to edit, add, or remove highlights after they're seeded from the GPX, so that I can curate the final set shown to visitors.
18. As the site admin, I want to define a hike's slug myself rather than have it auto-generated, so that I control the exact URL used for the hike.
19. As the site admin, I want to set a hike's start date and optionally leave its end date open, so that I can represent an ongoing trip whose finish date isn't known yet.
20. As the site admin, I want to configure Garmin (MapShare) and Strava connections once in a single global settings panel, so that I don't have to reconfigure ingestion for every new hike.
21. As the site admin, I want incoming Garmin/Strava data to automatically be attributed to the correct hike based on timing, so that I don't have to manually assign every tracking point or activity.
22. As the site admin, I want to designate which hike is the "default" shown at the root URL, so that visitors always land on the trip I consider current.
23. As the site admin, I want the default hike to automatically point at whichever hike I most recently created, so that I don't have to manually flip it for the common case of starting a new trip.
24. As the site admin, I want to manually override the default hike at any time, so that creating a future hike's record early doesn't prematurely steal the "current" slot from a trip that's still ongoing.
25. As the site admin, I want to see logged near-miss matches when a tracking point was ambiguously close to two overlapping hikes' windows, so that I can spot and investigate misattributed data.
26. As the site admin, I want tracking points and activities with no matching hike (timestamp outside every hike's date range) to be silently discarded, so that irrelevant background noise doesn't pollute the dataset.
27. As the site admin, I want existing Appalachian Trail data to be automatically migrated into the new hike model when this feature ships, so that the AT hike keeps working exactly as it does today without manual re-entry.
28. As the site admin, I want gear, blog tags, polls, and cheers to be scoped to a specific hike when I create/manage them, so that trip-specific content doesn't bleed into other hikes.
29. As the ingestion pipeline, I want to evaluate every incoming Garmin point against every hike whose date range covers its timestamp, so that overlapping trips are handled without manual per-hike configuration.
30. As the ingestion pipeline, when a point's timestamp falls within exactly one hike's range, I want to attribute it to that hike even if it's geographically far from that hike's trail line, so that legitimate off-route data (town stops, resupply detours) isn't lost or misattributed.
31. As the ingestion pipeline, when a point's timestamp falls within multiple hikes' overlapping ranges, I want to attribute it to whichever hike's trail geometry is closest, so that ambiguous cases resolve to the most plausible trip.
32. As the ingestion pipeline, I want to apply the same date-range + geometry classification logic to Strava activities as to Garmin points, so that both data sources are attributed consistently.
33. As the site admin, I want the app's branding (e.g. PWA name/description) to reflect its role as a general multi-hike tracker rather than being Appalachian-Trail-specific, so that new hikes don't feel bolted onto a single-trail identity.

## Implementation Decisions

- New `hikes` entity: slug (admin-typed, not derived), name, description, start date (required), end date (nullable — open means "still ongoing"), trail line geometry, elevation profile, total distance, and a highlights/points-of-interest list. Trail line, elevation profile, and distance are derived from the uploaded GPX at creation time; highlights are seeded from GPX waypoints and independently editable afterward.
- No explicit lifecycle/status field on a hike. "Upcoming" vs "current" vs "finished" is entirely derived from whether the hike's date range covers the current time — a hike with a future start date simply receives no ingested data yet. An explicit admin "Finish" action is deliberately out of scope for this iteration (see Out of Scope).
- New global settings entity holding: the default-hike reference, and Garmin/Strava ingestion configuration — replacing the current single environment-variable approach for the Garmin device ID, moving it to an admin-editable panel instead of requiring a redeploy to change. Strava's OAuth connection remains a single global record (one athlete account feeds all hikes).
- Existing tracking-points, Strava-activities, gear-categories, polls, and cheers entities each gain a reference to a hike.
- New `HikeClassifierService` — the single seam this spec is built around (see Testing Decisions). Encapsulates the point/activity → hike attribution algorithm:
  - Input: an event's timestamp and coordinates, plus the set of hikes.
  - Gather every hike whose date range covers the timestamp (an open end date counts as covering everything from its start date onward).
  - Zero candidates → no match; the event is discarded, not persisted.
  - Exactly one candidate → that hike, regardless of the event's distance from that hike's trail geometry.
  - More than one candidate (overlapping hikes) → the hike whose trail line is geographically closest wins; the non-winning candidate(s) are recorded as a loggable near-miss for admin review.
  - Both the Garmin ingestion flow and the Strava sync flow call into this one classifier rather than maintaining separate matching logic each.
- Hike creation is an admin-only flow: GPX upload plus manually entered name, slug, description, start date, and optional end date. Parsing (trail line, elevation profile, distance, waypoints) happens server-side at upload time.
- Global admin settings panel is the one place to: configure Garmin device(s)/MapShare and the Strava connection, and view/switch the default-hike pointer. The default hike auto-updates to whichever hike was most recently created, and is manually overridable at any time from the same panel.
- Routing: the root path resolves to the current default hike; an index route lists every hike (past, current, and future/planned); every hike also has a stable, explicit slug-keyed path that works regardless of which hike is currently default.
- Auxiliary features become hike-scoped: gear categories/items are queried per hike; the underlying blog CMS is unchanged but posts are associated with a hike via a tag, presented as one unified chronological feed with an optional per-hike filter (not separate silos); polls and cheers gain the same hike scoping as gear.
- Units: a single global metric/imperial toggle in the UI, applied uniformly to distance, elevation, and gear weight displays, persisted client-side. Canonical stored values remain metric internally regardless of display preference.
- Migration: existing Appalachian Trail data (currently static bundled files, no explicit trip-window filtering) is converted into the new hike model as part of this rollout — becoming a real hike record with equivalent trail geometry, elevation profile, and highlights, with every existing tracking point, Strava activity, gear item, poll, and cheer backfilled with a reference to it. One-time, one-directional; no dual-write or legacy code path retained afterward.
- Branding: general app description/metadata updated to no longer describe the app as Appalachian-Trail-specific.

## Testing Decisions

- A good test here exercises the classifier's external behavior only: given a timestamp/coordinate and a set of candidate hikes (plain fixture data, no database), assert which hike — if any — is returned. Internals of how the matching is computed are not asserted directly.
- The `HikeClassifierService` is the single seam covered by automated tests in this spec, following the existing precedent in the codebase (the health-check test) of instantiating via a NestJS testing module with dependencies stubbed out — no live database, no real Garmin/Strava calls.
- Coverage should include, at minimum:
  - No hike's date range covers the timestamp → no match, nothing persisted.
  - Exactly one hike's range covers the timestamp, with the event geographically far from that hike's trail → still matches that hike.
  - Two hikes' ranges overlap the timestamp, with the event closer to one hike's trail than the other → matches the closer hike, records the other as a near-miss.
  - A hike with an open end date whose start date has already passed → remains a valid candidate indefinitely.
- The Garmin ingestion flow and Strava sync flow that call the classifier are not independently tested in this spec — they're trusted to pass correct inputs to the one tested seam.
- GPX parsing at hike creation, admin CRUD flows, and frontend routing/rendering are explicitly not covered by automated tests in this spec — confirmed with the project owner. GPX parsing errors are immediately visible to the uploading admin, and the remaining pieces are largely plumbing around the one piece of real algorithmic risk.

## Out of Scope

- An explicit hike lifecycle/status field (e.g. a manual "Finish" action distinct from the date range) — deferred to a future iteration.
- Per-hike Garmin/Strava configuration — deliberately rejected in favor of a single global ingestion configuration.
- Multiple Strava athlete accounts or multi-user auth — the app remains single-admin, single-athlete.
- Creating the West Coast Trail hike itself — this spec covers the platform capability; creating that specific hike happens afterward, once its GPX file is available.
- Automated tests for GPX parsing, admin CRUD, and frontend behavior (see Testing Decisions).
- Retroactive geometry-based reclassification of already-ingested Appalachian Trail data — the migration preserves existing data as-is under the new model rather than re-running the classifier against it.

## Further Notes

- Highlights auto-seeding from GPX waypoints is a best-effort default; exact behavior (e.g. a GPX with no waypoints at all) should be revisited once a real West Coast Trail GPX file is available to test against.
- This spec was scoped via an interview with the project owner. Key resolved ambiguities worth remembering if questions resurface: the "default hike" concept is unrelated to point-classification fallback (it only governs root-URL routing); a point matching one hike's date range is kept even if geographically off that hike's trail — only a total absence of any matching hike causes discard.
