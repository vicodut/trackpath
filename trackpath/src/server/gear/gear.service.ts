import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { gearCategories, gearItems } from '../../db/schema.js';
import type { GearCategory, GearItem } from '../../db/schema.js';
import { DRIZZLE } from '../database/drizzle.constants.js';
import type { DrizzleClient } from '../database/drizzle.types.js';
import type {
  CreateCategoryBody,
  CreateItemBody,
  ImportRow,
  UpdateCategoryBody,
  UpdateItemBody,
} from './gear.types.js';

const PALETTE = [
  '#e05252', '#e08c52', '#d4c44a', '#52a852',
  '#52a8a8', '#5278e0', '#a852e0', '#888888',
];

@Injectable()
export class GearService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async getAll(): Promise<{ categories: GearCategory[]; items: GearItem[] }> {
    const [categories, items] = await Promise.all([
      this.db.select().from(gearCategories).orderBy(gearCategories.sortOrder),
      this.db.select().from(gearItems).orderBy(gearItems.id),
    ]);
    return { categories, items };
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async createCategory(body: CreateCategoryBody): Promise<GearCategory> {
    if (!body.name) throw new BadRequestException('name required');
    const [cat] = await this.db
      .insert(gearCategories)
      .values({
        name: body.name,
        color: body.color ?? '#888888',
        sortOrder: body.sortOrder ?? 0,
      })
      .returning();
    return cat;
  }

  async updateCategory(id: number, body: UpdateCategoryBody): Promise<void> {
    const updates: Partial<{ name: string; color: string; sortOrder: number }> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.color !== undefined) updates.color = body.color;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    await this.db.update(gearCategories).set(updates).where(eq(gearCategories.id, id));
  }

  async deleteCategory(id: number): Promise<void> {
    await this.db.delete(gearCategories).where(eq(gearCategories.id, id));
  }

  // ---------------------------------------------------------------------------
  // Items
  // ---------------------------------------------------------------------------

  async createItem(body: CreateItemBody): Promise<GearItem> {
    if (!body.name || !body.categoryId) {
      throw new BadRequestException('name and categoryId required');
    }
    const [item] = await this.db
      .insert(gearItems)
      .values({
        categoryId: body.categoryId,
        name: body.name,
        weightG: body.weightG ?? 0,
        qty: body.qty ?? 1,
        worn: body.worn ?? false,
        consumable: body.consumable ?? false,
        notes: body.notes ?? null,
      })
      .returning();
    return item;
  }

  async updateItem(id: number, body: UpdateItemBody): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.weightG !== undefined) updates.weightG = body.weightG;
    if (body.qty !== undefined) updates.qty = body.qty;
    if (body.worn !== undefined) updates.worn = body.worn;
    if (body.consumable !== undefined) updates.consumable = body.consumable;
    if (body.included !== undefined) updates.included = body.included;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.notes !== undefined) updates.notes = body.notes;
    await this.db.update(gearItems).set(updates).where(eq(gearItems.id, id));
  }

  async deleteItem(id: number): Promise<void> {
    await this.db.delete(gearItems).where(eq(gearItems.id, id));
  }

  // ---------------------------------------------------------------------------
  // Bulk import
  // ---------------------------------------------------------------------------

  async importItems(rows: ImportRow[]): Promise<{ imported: number }> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No rows provided');
    }

    // Resolve category names → ids, creating missing categories on the fly.
    const existingCats = await this.db.select().from(gearCategories);
    const catMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c]));
    let palIdx = existingCats.length % PALETTE.length;

    const uniqueNames = [...new Set(rows.map((r) => r.category).filter(Boolean))];
    for (const catName of uniqueNames) {
      if (!catMap.has(catName.toLowerCase())) {
        const [newCat] = await this.db
          .insert(gearCategories)
          .values({
            name: catName,
            color: PALETTE[palIdx % PALETTE.length],
            sortOrder: catMap.size,
          })
          .returning();
        catMap.set(catName.toLowerCase(), newCat);
        palIdx++;
      }
    }

    const inserted = await this.db
      .insert(gearItems)
      .values(
        rows.map((r) => ({
          categoryId: catMap.get(r.category.toLowerCase())!.id,
          name: r.name,
          weightG: r.weightG,
          qty: r.qty,
          worn: r.worn,
          consumable: r.consumable,
          notes: r.notes ?? null,
        })),
      )
      .returning();

    return { imported: inserted.length };
  }
}
