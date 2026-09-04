import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { HikeClassifierService } from './hike-classifier.service.js';
import type { ClassifiableHike } from './hike-classifier.types.js';

/** A short square loop near (10, 10), roughly 0.1km on a side. */
const NEAR_TRAIL: [number, number][] = [
  [10, 10],
  [10.001, 10],
  [10.001, 10.001],
  [10, 10.001],
];

/** A trail far away, near (50, 50). */
const FAR_TRAIL: [number, number][] = [
  [50, 50],
  [50.001, 50],
];

function hike(overrides: Partial<ClassifiableHike>): ClassifiableHike {
  return {
    id: 1,
    startDate: '2026-01-01',
    endDate: null,
    trailCoords: NEAR_TRAIL,
    ...overrides,
  };
}

describe('HikeClassifierService', () => {
  let service: HikeClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HikeClassifierService],
    }).compile();

    service = module.get<HikeClassifierService>(HikeClassifierService);
  });

  it('returns no match when no hike\'s date range covers the timestamp', () => {
    const hikes = [hike({ id: 1, startDate: '2026-06-01', endDate: '2026-06-30' })];
    const result = service.classify('2026-01-15T12:00:00Z', 10, 10, hikes);
    expect(result).toBeNull();
  });

  it('matches the single hike whose range covers the timestamp, even if geographically far from its trail', () => {
    const hikes = [hike({ id: 1, startDate: '2026-01-01', endDate: '2026-01-31', trailCoords: FAR_TRAIL })];
    // Point near (10, 10) — nowhere near the FAR_TRAIL at (50, 50) — but still the only date-range match.
    const result = service.classify('2026-01-15T12:00:00Z', 10, 10, hikes);
    expect(result).toEqual({ hikeId: 1, nearMisses: [] });
  });

  it('picks the geographically closer hike when two ranges overlap the timestamp', () => {
    const hikes = [
      hike({ id: 1, startDate: '2026-01-01', endDate: '2026-01-31', trailCoords: NEAR_TRAIL }),
      hike({ id: 2, startDate: '2026-01-10', endDate: '2026-02-10', trailCoords: FAR_TRAIL }),
    ];
    const result = service.classify('2026-01-15T12:00:00Z', 10, 10, hikes);
    expect(result).toEqual({ hikeId: 1, nearMisses: [2] });
  });

  it('treats a null end date as still ongoing indefinitely', () => {
    const hikes = [hike({ id: 1, startDate: '2026-01-01', endDate: null })];
    const result = service.classify('2027-06-01T00:00:00Z', 10, 10, hikes);
    expect(result).toEqual({ hikeId: 1, nearMisses: [] });
  });

  it('returns no match before a hike\'s start date, even with an open end date', () => {
    const hikes = [hike({ id: 1, startDate: '2026-06-01', endDate: null })];
    const result = service.classify('2026-01-01T00:00:00Z', 10, 10, hikes);
    expect(result).toBeNull();
  });
});
