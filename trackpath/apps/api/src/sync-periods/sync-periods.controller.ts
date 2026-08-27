import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { SyncPeriodsService } from './sync-periods.service.js';
import { CreateSyncPeriodDto } from './sync-periods.dto.js';

/** Admin-managed date ranges that restrict Garmin + Strava sync data. */
@Controller('admin/sync-periods')
@UseGuards(AdminGuard)
export class SyncPeriodsController {
  constructor(private readonly syncPeriodsService: SyncPeriodsService) {}

  @Get()
  getAll() {
    return this.syncPeriodsService.getAll();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  create(@Body() dto: CreateSyncPeriodDto) {
    return this.syncPeriodsService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.syncPeriodsService.remove(id).then(() => ({ ok: true }));
  }
}
