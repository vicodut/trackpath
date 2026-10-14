import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { appSettings } from '@trackpath/db/schema';
import type { AppSettings } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';

/**
 * Single global settings row: the default-hike pointer (which hike `/`
 * resolves to) and the Garmin device config, replacing the old MAPSHARE_ID
 * env var with an admin-editable value.
 */
@Injectable()
export class AppSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  /** Fetches the single settings row, creating an empty one on first access. */
  async get(): Promise<AppSettings> {
    const rows = await this.db.select().from(appSettings).limit(1);
    if (rows[0]) return rows[0];
    const [created] = await this.db.insert(appSettings).values({}).returning();
    return created;
  }

  async getMapshareId(): Promise<string | null> {
    return (await this.get()).mapshareId;
  }

  async getDefaultHikeId(): Promise<number | null> {
    return (await this.get()).defaultHikeId;
  }

  async setMapshareId(mapshareId: string | null): Promise<AppSettings> {
    const row = await this.get();
    const [updated] = await this.db
      .update(appSettings)
      .set({ mapshareId, updatedAt: new Date() })
      .where(eq(appSettings.id, row.id))
      .returning();
    return updated;
  }

  async setDefaultHikeId(defaultHikeId: number): Promise<AppSettings> {
    const row = await this.get();
    const [updated] = await this.db
      .update(appSettings)
      .set({ defaultHikeId, updatedAt: new Date() })
      .where(eq(appSettings.id, row.id))
      .returning();
    return updated;
  }
}
