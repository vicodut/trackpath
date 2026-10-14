/**
 * Seed script: insert simulated GPS tracking points along the AT.
 * Run with: npx tsx scripts/seed-gps.ts
 *
 * Points run from Springer Mountain, GA northward into NC over ~3 weeks.
 * Each point gets a garmin_id of "sim-NNN" so they won't conflict with real data
 * and can be removed with: DELETE FROM tracking_points WHERE garmin_id LIKE 'sim-%';
 */

import 'dotenv/config';
import { db } from '../src/db/index.js';
import { trackingPoints } from '../src/db/schema.js';

// Approximate AT waypoints [lat, lon, altitudeM, label]
const WAYPOINTS: [number, number, number, string][] = [
  [34.6274, -84.1939,  1108, 'Springer Mountain, GA — Southern terminus'],
  [34.6478, -84.1720,  1020, 'Hawk Mountain Shelter area'],
  [34.6712, -84.1502,   900, 'Three Forks'],
  [34.6978, -84.1456,   823, 'Gooch Mountain Shelter'],
  [34.7012, -84.0969,   915, 'Woody Gap'],
  [34.7231, -84.0251,  1134, 'Bull Mountain area'],
  [34.7388, -83.9342,  1372, 'Blood Mountain — highest point in GA'],
  [34.7373, -83.9001,  1051, 'Neels Gap — Mountain Crossings'],
  [34.7891, -83.8734,   980, 'Whitley Gap Shelter'],
  [34.8167, -83.8613,   940, 'Tesnatee Gap'],
  [34.8497, -83.8269,  1107, 'Hogpen Gap'],
  [34.8825, -83.7981,   963, 'Low Gap Shelter'],
  [34.9202, -83.7689,  1039, 'Blue Ridge Gap'],
  [34.9314, -83.7425,   939, 'Unicoi Gap'],
  [35.0023, -83.7012,  1250, 'Rocky Mountain area'],
  [35.0232, -83.6879,  1437, 'Tray Mountain'],
  [35.0654, -83.6317,   713, 'Dicks Creek Gap'],
  [35.0956, -83.5912,   975, 'Plumorchard Gap Shelter'],
  [35.1034, -83.5312,  1270, 'Bly Gap — GA/NC border'],
  [35.1451, -83.4903,   987, 'Rock Gap Shelter, NC'],
  [35.1623, -83.4756,   914, 'Wallace Gap'],
  [35.1823, -83.3891,  1018, 'Winding Stair Gap'],
  [35.2012, -83.3456,  1134, 'Siler Bald Shelter'],
  [35.2234, -83.2956,   632, 'Wayah Road'],
  [35.1834, -83.5623,  1780, 'Standing Indian Mountain — highest point so far'],
];

// Start date: 30 days ago, one point per 1-2 days
const START_DATE = new Date();
START_DATE.setDate(START_DATE.getDate() - 30);

const points = WAYPOINTS.map(([ lat, lon, alt, message ], i) => {
  const ts = new Date(START_DATE);
  ts.setHours(ts.getHours() + i * 30 + Math.floor(Math.random() * 6)); // ~30h apart
  return {
    garminId: `sim-${String(i + 1).padStart(3, '0')}`,
    latitude: lat + (Math.random() - 0.5) * 0.001, // tiny jitter
    longitude: lon + (Math.random() - 0.5) * 0.001,
    altitude: alt + Math.random() * 20,
    timestamp: ts.toISOString(),
    velocity: Math.random() * 4 + 2,   // 2–6 km/h
    course: Math.random() * 360,
    message,
    eventType: null,
  };
});

// Sort by timestamp ascending
points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

for (const pt of points) {
  await db.insert(trackingPoints).values(pt).onConflictDoNothing();
  console.log(`✓ ${pt.garminId} — ${pt.message}`);
}

console.log(`\nInserted ${points.length} simulated GPS points.`);
console.log('To remove: DELETE FROM tracking_points WHERE garmin_id LIKE \'sim-%\';');
process.exit(0);
