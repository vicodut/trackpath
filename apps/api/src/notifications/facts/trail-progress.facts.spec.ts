import { TrailProgressFacts } from './trail-progress.facts.js';
import type { DrizzleClient } from '../../database/drizzle.types.js';

/** Stubs the Drizzle select chain at its edge; resolves to the given rows. */
function dbReturning(rows: { latitude: number; longitude: number }[]): DrizzleClient {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return { select: () => chain } as unknown as DrizzleClient;
}

describe('TrailProgressFacts', () => {
  it('returns nothing when the day has no fix', async () => {
    const facts = new TrailProgressFacts(dbReturning([]));
    expect(await facts.getFacts('2026-06-01')).toEqual([]);
  });

  it('reports progress as "X km of Y" using the frontend snapping (second sample is at 6.08 km)', async () => {
    const facts = new TrailProgressFacts(dbReturning([{ latitude: 34.662358, longitude: -84.184423 }]));
    const [progress] = await facts.getFacts('2026-06-01');
    expect(progress).toBe('Trail progress: 6 km of 3119 km');
  });

  it('names the nearest highlight, "at" it when on top of it', async () => {
    const facts = new TrailProgressFacts(dbReturning([{ latitude: 40.0341226, longitude: -77.3566789 }]));
    const [, highlight] = await facts.getFacts('2026-06-01');
    expect(highlight).toBe("Nearest highlight: at Tom's Run Shelter");
  });

  it('gives a rough km offset when away from the highlight', async () => {
    // about 1.1 km north of Tom's Run Shelter
    const facts = new TrailProgressFacts(dbReturning([{ latitude: 40.0441226, longitude: -77.3566789 }]));
    const [, highlight] = await facts.getFacts('2026-06-01');
    expect(highlight).toBe("Nearest highlight: about 1 km from Tom's Run Shelter");
  });

  it('never prints latitude or longitude values', async () => {
    const facts = new TrailProgressFacts(dbReturning([{ latitude: 40.0441226, longitude: -77.3566789 }]));
    const text = (await facts.getFacts('2026-06-01')).join('\n');
    expect(text).not.toMatch(/40\.0\d*|77\.3\d*|-?\d+\.\d{3,}/);
  });
});
