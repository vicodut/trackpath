import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { GearService } from './gear.service.js';
import type { CreateCategoryBody, CreateItemBody, ImportRow, UpdateCategoryBody, UpdateItemBody } from './gear.types.js';

@Controller('gear')
export class GearController {
  constructor(private readonly gearService: GearService) {}

  @Get()
  getAll() {
    return this.gearService.getAll();
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  @Post('categories')
  @UseGuards(AdminGuard)
  createCategory(@Body() body: CreateCategoryBody) {
    return this.gearService.createCategory(body);
  }

  @Put('categories/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCategoryBody,
  ) {
    return this.gearService.updateCategory(id, body).then(() => ({ ok: true }));
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.gearService.deleteCategory(id).then(() => ({ ok: true }));
  }

  // ── Items ───────────────────────────────────────────────────────────────────

  @Post('items')
  @UseGuards(AdminGuard)
  createItem(@Body() body: CreateItemBody) {
    return this.gearService.createItem(body);
  }

  @Put('items/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateItemBody,
  ) {
    return this.gearService.updateItem(id, body).then(() => ({ ok: true }));
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  deleteItem(@Param('id', ParseIntPipe) id: number) {
    return this.gearService.deleteItem(id).then(() => ({ ok: true }));
  }

  // ── Bulk import ─────────────────────────────────────────────────────────────

  @Post('import')
  @UseGuards(AdminGuard)
  importItems(@Body() rows: ImportRow[]) {
    return this.gearService.importItems(rows);
  }
}
