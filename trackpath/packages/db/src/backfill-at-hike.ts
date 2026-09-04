import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import {
  hikes,
  appSettings,
  trackingPoints,
  stravaActivities,
  gearCategories,
  polls,
  pollSuggestions,
  cheers,
} from './schema.js';

/**
 * One-time data migration: converts the static AT trail files (previously
 * bundled in apps/web/public) into the first `hikes` row, then backfills
 * every existing hike-scoped table to reference it. Idempotent — safe to
 * re-run; does nothing if the 'at' hike already exists.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const webPublicDir = resolve(__dirname, '../../../apps/web/public');

interface ElevationSample {
  lat: number;
  lon: number;
  elevation: number;
  distanceKm: number;
}

async function main(): Promise<void> {
  const sqlClient = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sqlClient);

  const [existing] = await db.select().from(hikes).where(eq(hikes.slug, 'at')).limit(1);
  if (existing) {
    console.log(`'at' hike already exists (id=${existing.id}) — nothing to do.`);
    await sqlClient.end();
    return;
  }

  const trailCoords = readFileSync(resolve(webPublicDir, 'at-trail.json'), 'utf8');
  const elevationProfileRaw = readFileSync(resolve(webPublicDir, 'at-trail-elevation.json'), 'utf8');
  const highlights = readFileSync(resolve(webPublicDir, 'at-highlights.json'), 'utf8');

  const elevationProfile: ElevationSample[] = JSON.parse(elevationProfileRaw);
  const distanceKm = elevationProfile[elevationProfile.length - 1]?.distanceKm ?? 0;

  const [hike] = await db
    .insert(hikes)
    .values({
      slug: 'at',
      name: 'Appalachian Trail',
      description: 'Springer Mountain, GA to Mount Katahdin, ME.',
      startDate: '2026-04-15',
      endDate: null,
      trailCoords,
      elevationProfile: elevationProfileRaw,
      distanceKm,
      highlights,
    })
    .returning();

  console.log(`Created 'at' hike (id=${hike.id}, ${distanceKm}km).`);

  const [settingsRow] = await db.select().from(appSettings).limit(1);
  if (settingsRow) {
    await db
      .update(appSettings)
      .set({ defaultHikeId: hike.id, mapshareId: settingsRow.mapshareId ?? process.env.MAPSHARE_ID ?? null })
      .where(eq(appSettings.id, settingsRow.id));
  } else {
    await db.insert(appSettings).values({
      defaultHikeId: hike.id,
      mapshareId: process.env.MAPSHARE_ID ?? null,
    });
  }
  console.log(`Set default hike to '${hike.slug}'.`);

  const backfillPoints = await db.update(trackingPoints).set({ hikeId: hike.id }).where(isNull(trackingPoints.hikeId)).returning({ id: trackingPoints.id });
  const backfillActivities = await db.update(stravaActivities).set({ hikeId: hike.id }).where(isNull(stravaActivities.hikeId)).returning({ id: stravaActivities.id });
  const backfillGear = await db.update(gearCategories).set({ hikeId: hike.id }).where(isNull(gearCategories.hikeId)).returning({ id: gearCategories.id });
  const backfillPolls = await db.update(polls).set({ hikeId: hike.id }).where(isNull(polls.hikeId)).returning({ id: polls.id });
  const backfillPollSuggestions = await db.update(pollSuggestions).set({ hikeId: hike.id }).where(isNull(pollSuggestions.hikeId)).returning({ id: pollSuggestions.id });
  const backfillCheers = await db.update(cheers).set({ hikeId: hike.id }).where(isNull(cheers.hikeId)).returning({ id: cheers.id });

  console.log(`Backfilled ${backfillPoints.length} tracking_points, ${backfillActivities.length} strava_activities, ${backfillGear.length} gear_categories, ${backfillPolls.length} polls, ${backfillPollSuggestions.length} poll_suggestions, ${backfillCheers.length} cheers.`);

  await sqlClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
