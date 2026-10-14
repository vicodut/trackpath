import { Injectable, Inject } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { hikes } from '@trackpath/db/schema';
import type { Hike } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type { ClassifiableHike } from './hike-classifier.types.js';

@Injectable()
export class HikesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  getAll(): Promise<Hike[]> {
    return this.db.select().from(hikes).orderBy(asc(hikes.startDate));
  }

  async getById(id: number): Promise<Hike | null> {
    const rows = await this.db.select().from(hikes).where(eq(hikes.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async getBySlug(slug: string): Promise<Hike | null> {
    const rows = await this.db.select().from(hikes).where(eq(hikes.slug, slug)).limit(1);
    return rows[0] ?? null;
  }

  /** All hikes shaped for HikeClassifierService, with trailCoords parsed out of its stored JSON. */
  async getClassifiable(): Promise<ClassifiableHike[]> {
    const all = await this.getAll();
    return all.map((h) => ({
      id: h.id,
      startDate: h.startDate,
      endDate: h.endDate,
      trailCoords: JSON.parse(h.trailCoords) as [number, number][],
    }));
  }
}
