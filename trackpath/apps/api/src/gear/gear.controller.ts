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
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateItemDto,
  UpdateItemDto,
  ImportRowDto,
} from './gear.dto.js';

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
  createCategory(@Body() body: CreateCategoryDto) {
    return this.gearService.createCategory(body);
  }

  @Put('categories/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCategoryDto,
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
  createItem(@Body() body: CreateItemDto) {
    return this.gearService.createItem(body);
  }

  @Put('items/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateItemDto,
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
  importItems(@Body() rows: ImportRowDto[]) {
    return this.gearService.importItems(rows);
  }
}
