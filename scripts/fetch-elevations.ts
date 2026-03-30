import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRAIL_PATH = join(__dirname, '..', 'public', 'at-trail.json');
const OUTPUT_PATH = join(__dirname, '..', 'public', 'at-trail-elevation.json');

// Open-Meteo supports up to 100 coordinates per request
const BATCH_SIZE = 100;
// Sample every Nth point to keep the profile manageable (~500 points)
const SAMPLE_RATE = 20;

interface ElevationResponse {
  elevation: number[];
}

async function fetchElevations(coords: number[][]): Promise<number[]> {
  const elevations: number[] = [];

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE);
    const lats = batch.map(c => c[0]).join(',');
    const lons = batch.map(c => c[1]).join(',');
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as ElevationResponse;
    elevations.push(...data.elevation);

    // Rate limiting: small delay between batches
    if (i + BATCH_SIZE < coords.length) {
      await new Promise(r => setTimeout(r, 100));
    }

    const progress = Math.min(i + BATCH_SIZE, coords.length);
    console.log(`Fetched ${progress}/${coords.length} points`);
  }

  return elevations;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const trail: number[][] = JSON.parse(readFileSync(TRAIL_PATH, 'utf-8'));
  console.log(`Total trail points: ${trail.length}`);

  // Compute cumulative distance using ALL points for accuracy
  const cumDistAll: number[] = [0];
  for (let i = 1; i < trail.length; i++) {
    cumDistAll.push(cumDistAll[i - 1] + haversine(
      trail[i - 1][0], trail[i - 1][1],
      trail[i][0], trail[i][1],
    ));
  }
  console.log(`Full-resolution trail distance: ${cumDistAll[cumDistAll.length - 1].toFixed(1)} km`);

  // Sample points for elevation queries
  const sampledIndices = trail
    .map((_, i) => i)
    .filter(i => i % SAMPLE_RATE === 0);
  // Always include the last point
  if ((trail.length - 1) % SAMPLE_RATE !== 0) {
    sampledIndices.push(trail.length - 1);
  }
  const sampled = sampledIndices.map(i => trail[i]);
  console.log(`Sampled points: ${sampled.length}`);

  const elevations = await fetchElevations(sampled);

  // Build profile using full-resolution cumulative distances
  const profile = sampledIndices.map((trailIdx, i) => ({
    lat: trail[trailIdx][0],
    lon: trail[trailIdx][1],
    elevation: elevations[i],
    distanceKm: Math.round(cumDistAll[trailIdx] * 100) / 100,
  }));

  writeFileSync(OUTPUT_PATH, JSON.stringify(profile));
  const totalDist = cumDistAll[cumDistAll.length - 1];
  console.log(`Wrote ${profile.length} points to ${OUTPUT_PATH}`);
  console.log(`Total trail distance: ${totalDist.toFixed(1)} km`);
  console.log(`Elevation range: ${Math.min(...elevations).toFixed(0)}m - ${Math.max(...elevations).toFixed(0)}m`);
}

main().catch(console.error);
