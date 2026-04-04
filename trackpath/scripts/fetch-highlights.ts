import { writeFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_PATH = join(__dirname, '..', 'public', 'at-highlights.json');
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface Highlight {
  id: string;
  category: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
  description?: string;
}

// Preamble to resolve the AT super-relation into trail nodes
// Using nodes (not ways) for `around` is much faster on Overpass
const AT_PREAMBLE = `
rel["name"="Appalachian Trail"]["type"="superroute"]->.at;
rel(r.at)->.sections;
way(r.sections)->.trailways;
node(w.trailways)->.trail;
`;

async function queryOverpass(query: string, retries = 3): Promise<OverpassElement[]> {
  const fullQuery = `[out:json][timeout:180][maxsize:536870912];\n${query}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${retries}...`);
      await delay(5000);
    }
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(fullQuery)}`,
    });
    if (res.status === 504 || res.status === 429) continue;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Overpass error ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.elements || [];
  }
  throw new Error('Overpass: max retries exceeded');
}

function getCoords(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

async function fetchShelters(): Promise<Highlight[]> {
  console.log('Fetching shelters...');
  const elements = await queryOverpass(`
    ${AT_PREAMBLE}
    (
      node["amenity"="shelter"](around.trail:500);
      way["amenity"="shelter"](around.trail:500);
      node["tourism"="wilderness_hut"](around.trail:500);
      way["tourism"="wilderness_hut"](around.trail:500);
      node["tourism"="alpine_hut"](around.trail:500);
      way["tourism"="alpine_hut"](around.trail:500);
    );
    out center;
  `);

  return elements
    .map(el => {
      const coords = getCoords(el);
      if (!coords || !el.tags?.name) return null;
      return {
        id: `shelter-${el.id}`,
        category: 'shelter',
        name: el.tags.name,
        lat: coords.lat,
        lon: coords.lon,
        elevation: el.tags.ele ? parseFloat(el.tags.ele) : undefined,
        description: el.tags.description || el.tags.shelter_type || undefined,
      };
    })
    .filter((h): h is Highlight => h !== null);
}

async function fetchSummits(): Promise<Highlight[]> {
  console.log('Fetching summits...');
  const elements = await queryOverpass(`
    ${AT_PREAMBLE}
    node["natural"="peak"]["name"]["ele"](around.trail:800);
    out body;
  `);

  return elements
    .map(el => {
      const coords = getCoords(el);
      if (!coords || !el.tags?.name) return null;
      const ele = el.tags.ele ? parseFloat(el.tags.ele) : undefined;
      return {
        id: `summit-${el.id}`,
        category: 'summit',
        name: el.tags.name,
        lat: coords.lat,
        lon: coords.lon,
        elevation: ele,
        description: ele ? `${Math.round(ele)}m` : undefined,
      };
    })
    .filter((h): h is Highlight => h !== null);
}

async function fetchCampsites(): Promise<Highlight[]> {
  console.log('Fetching campsites...');
  const elements = await queryOverpass(`
    ${AT_PREAMBLE}
    (
      node["tourism"="camp_site"](around.trail:500);
      way["tourism"="camp_site"](around.trail:500);
    );
    out center;
  `);

  return elements
    .map(el => {
      const coords = getCoords(el);
      if (!coords) return null;
      const name = el.tags?.name || 'Campsite';
      return {
        id: `campsite-${el.id}`,
        category: 'campsite',
        name,
        lat: coords.lat,
        lon: coords.lon,
        description: el.tags?.description || undefined,
      };
    })
    .filter((h): h is Highlight => h !== null);
}

async function fetchTowns(): Promise<Highlight[]> {
  console.log('Fetching trail towns...');
  const elements = await queryOverpass(`
    ${AT_PREAMBLE}
    node["place"~"^(town|village|city)$"]["name"](around.trail:1500);
    out body;
  `);

  return elements
    .map(el => {
      const coords = getCoords(el);
      if (!coords || !el.tags?.name) return null;
      const pop = el.tags.population ? parseInt(el.tags.population) : undefined;
      return {
        id: `town-${el.id}`,
        category: 'town',
        name: el.tags.name,
        lat: coords.lat,
        lon: coords.lon,
        description: pop ? `Pop. ${pop.toLocaleString()}` : undefined,
      };
    })
    .filter((h): h is Highlight => h !== null);
}

async function fetchRoadCrossings(): Promise<Highlight[]> {
  console.log('Fetching road crossings...');
  const elements = await queryOverpass(`
    ${AT_PREAMBLE}
    way["highway"~"^(trunk|primary|secondary)$"](around.trail:50);
    node(w)(around.trail:50);
    out body;
  `);

  // Dedupe nearby nodes (many nodes per road)
  const seen = new Set<string>();
  const results: Highlight[] = [];

  for (const el of elements) {
    const coords = getCoords(el);
    if (!coords) continue;
    // Round to ~100m grid to dedupe
    const key = `${(coords.lat * 100).toFixed(0)},${(coords.lon * 100).toFixed(0)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = el.tags?.name || el.tags?.ref || 'Road Crossing';
    results.push({
      id: `road-${el.id}`,
      category: 'road-crossing',
      name,
      lat: coords.lat,
      lon: coords.lon,
    });
  }

  return results;
}

async function fetchWaterSources(): Promise<Highlight[]> {
  console.log('Fetching water sources...');
  const elements = await queryOverpass(`
    ${AT_PREAMBLE}
    (
      node["natural"="spring"](around.trail:300);
      node["amenity"="drinking_water"](around.trail:300);
      node["amenity"="water_point"](around.trail:300);
    );
    out body;
  `);

  const seen = new Set<string>();
  const results: Highlight[] = [];
  for (const el of elements) {
    const coords = getCoords(el);
    if (!coords) continue;
    const key = `${(coords.lat * 1000).toFixed(0)},${(coords.lon * 1000).toFixed(0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = el.tags?.name || (el.tags?.natural === 'spring' ? 'Spring' : 'Water Source');
    results.push({
      id: `water-${el.id}`,
      category: 'water-source',
      name,
      lat: coords.lat,
      lon: coords.lon,
      description: el.tags?.description || undefined,
    });
  }
  return results;
}

// Curated notable landmarks
const CURATED_LANDMARKS: Highlight[] = [
  { id: 'lm-springer', category: 'landmark', name: 'Springer Mountain', lat: 34.6270, lon: -84.1940, description: 'Southern terminus of the AT' },
  { id: 'lm-amicalola', category: 'landmark', name: 'Amicalola Falls', lat: 34.5665, lon: -84.2474, description: 'Approach trail start' },
  { id: 'lm-neel-gap', category: 'landmark', name: 'Neel Gap (Mountain Crossings)', lat: 34.7358, lon: -83.9178, description: 'First resupply, famous outfitter' },
  { id: 'lm-clingmans', category: 'landmark', name: 'Clingmans Dome', lat: 35.5629, lon: -83.4985, elevation: 2025, description: 'Highest point on the AT (2,025m)' },
  { id: 'lm-mcafee', category: 'landmark', name: 'McAfee Knob', lat: 37.3932, lon: -80.0368, description: 'Most photographed spot on the AT' },
  { id: 'lm-harpers', category: 'landmark', name: "ATC HQ, Harpers Ferry", lat: 39.3258, lon: -77.7442, description: 'Appalachian Trail Conservancy headquarters, psychological midpoint' },
  { id: 'lm-midpoint', category: 'landmark', name: 'AT Midpoint Marker', lat: 40.0335, lon: -77.3078, description: 'Pine Grove Furnace State Park, home of the Half-Gallon Challenge' },
  { id: 'lm-delaware', category: 'landmark', name: 'Delaware Water Gap', lat: 40.9671, lon: -75.1260, description: 'Iconic river crossing into New Jersey' },
  { id: 'lm-bear-mtn', category: 'landmark', name: 'Bear Mountain', lat: 41.3133, lon: -73.9886, elevation: 393, description: 'Lowest point on the AT in the north' },
  { id: 'lm-franconia', category: 'landmark', name: 'Franconia Ridge', lat: 44.1435, lon: -71.6448, description: 'Iconic exposed ridge walk in the White Mountains' },
  { id: 'lm-washington', category: 'landmark', name: 'Mt. Washington', lat: 44.2706, lon: -71.3033, elevation: 1917, description: 'Highest peak in the northeastern US' },
  { id: 'lm-100mile', category: 'landmark', name: '100-Mile Wilderness Start', lat: 45.4528, lon: -69.6261, description: 'Beginning of the final remote stretch to Katahdin' },
  { id: 'lm-katahdin', category: 'landmark', name: 'Mt. Katahdin (Baxter Peak)', lat: 45.9044, lon: -68.9213, elevation: 1606, description: 'Northern terminus of the AT' },
  { id: 'lm-damascus', category: 'landmark', name: 'Damascus, VA', lat: 36.6346, lon: -81.7838, description: 'Trail Days festival town, "Trail Town USA"' },
  { id: 'lm-max-patch', category: 'landmark', name: 'Max Patch', lat: 35.7973, lon: -82.9612, elevation: 1378, description: 'Famous bald with 360-degree views' },
];

// Curated state border crossings (NOBO order)
const CURATED_STATE_BORDERS: Highlight[] = [
  { id: 'sb-ga-nc', category: 'state-border', name: 'Georgia / North Carolina', lat: 34.9955, lon: -83.5488, description: 'Bly Gap' },
  { id: 'sb-nc-tn', category: 'state-border', name: 'NC / Tennessee (first crossing)', lat: 35.3245, lon: -83.8294, description: 'Fontana Dam area' },
  { id: 'sb-tn-va', category: 'state-border', name: 'Tennessee / Virginia', lat: 36.6138, lon: -81.9269, description: 'Near Damascus' },
  { id: 'sb-va-wv', category: 'state-border', name: 'Virginia / West Virginia', lat: 39.3263, lon: -77.7296, description: 'Harpers Ferry' },
  { id: 'sb-wv-md', category: 'state-border', name: 'West Virginia / Maryland', lat: 39.3270, lon: -77.7280, description: 'Potomac River crossing' },
  { id: 'sb-md-pa', category: 'state-border', name: 'Maryland / Pennsylvania', lat: 39.7219, lon: -77.5043, description: 'Mason-Dixon Line' },
  { id: 'sb-pa-nj', category: 'state-border', name: 'Pennsylvania / New Jersey', lat: 40.9671, lon: -75.1260, description: 'Delaware Water Gap' },
  { id: 'sb-nj-ny', category: 'state-border', name: 'New Jersey / New York', lat: 41.1676, lon: -74.5091, description: 'State line near Hewitt' },
  { id: 'sb-ny-ct', category: 'state-border', name: 'New York / Connecticut', lat: 41.2622, lon: -73.5143, description: 'Near Hoyt Road' },
  { id: 'sb-ct-ma', category: 'state-border', name: 'Connecticut / Massachusetts', lat: 42.0499, lon: -73.4453, description: 'Sages Ravine area' },
  { id: 'sb-ma-vt', category: 'state-border', name: 'Massachusetts / Vermont', lat: 42.7472, lon: -73.1660, description: 'Near North Adams / Williamstown' },
  { id: 'sb-vt-nh', category: 'state-border', name: 'Vermont / New Hampshire', lat: 43.7071, lon: -72.0291, description: 'Connecticut River crossing' },
  { id: 'sb-nh-me', category: 'state-border', name: 'New Hampshire / Maine', lat: 44.2277, lon: -70.9718, description: 'Carlo Col area, Mahoosuc Range' },
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dedupe(highlights: Highlight[]): Highlight[] {
  const result: Highlight[] = [];
  for (const h of highlights) {
    const tooClose = result.some(
      existing => existing.category === h.category &&
        haversine(existing.lat, existing.lon, h.lat, h.lon) < 100
    );
    if (!tooClose) result.push(h);
  }
  return result;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const all: Highlight[] = [];

  const shelters = await fetchShelters();
  console.log(`  -> ${shelters.length} shelters`);
  all.push(...shelters);
  await delay(3000);

  const summits = await fetchSummits();
  console.log(`  -> ${summits.length} summits`);
  all.push(...summits);
  await delay(3000);

  const campsites = await fetchCampsites();
  console.log(`  -> ${campsites.length} campsites`);
  all.push(...campsites);
  await delay(3000);

  const towns = await fetchTowns();
  console.log(`  -> ${towns.length} towns`);
  all.push(...towns);
  await delay(3000);

  const roads = await fetchRoadCrossings();
  console.log(`  -> ${roads.length} road crossings`);
  all.push(...roads);
  await delay(3000);

  const water = await fetchWaterSources();
  console.log(`  -> ${water.length} water sources`);
  all.push(...water);

  // Add curated data
  all.push(...CURATED_LANDMARKS);
  console.log(`  -> ${CURATED_LANDMARKS.length} landmarks (curated)`);
  all.push(...CURATED_STATE_BORDERS);
  console.log(`  -> ${CURATED_STATE_BORDERS.length} state borders (curated)`);

  const deduped = dedupe(all);
  console.log(`\nTotal: ${all.length} -> ${deduped.length} after dedup`);

  // Summary
  const cats = new Map<string, number>();
  for (const h of deduped) cats.set(h.category, (cats.get(h.category) || 0) + 1);
  for (const [cat, count] of cats) console.log(`  ${cat}: ${count}`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(deduped));
  console.log(`\nWrote ${deduped.length} highlights to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
