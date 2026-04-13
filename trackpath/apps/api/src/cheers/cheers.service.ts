import { Injectable, Inject } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { cheers } from '@trackpath/db/schema';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type { CreateCheerDto } from './cheers.dto.js';

@Injectable()
export class CheersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleClient) {}

  async getPublic() {
    return this.db
      .select()
      .from(cheers)
      .where(eq(cheers.isPublic, true))
      .orderBy(desc(cheers.createdAt));
  }

  async getAll() {
    return this.db
      .select()
      .from(cheers)
      .orderBy(desc(cheers.createdAt));
  }

  async create(dto: CreateCheerDto) {
    const [cheer] = await this.db
      .insert(cheers)
      .values({
        name: dto.name,
        message: dto.message,
        isPublic: dto.isPublic ?? true,
      })
      .returning();
    return cheer;
  }

  async delete(id: number) {
    await this.db.delete(cheers).where(eq(cheers.id, id));
    return { ok: true };
  }
}
