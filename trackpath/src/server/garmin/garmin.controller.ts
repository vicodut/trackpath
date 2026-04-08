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
} from '@nestjs/common';
import { GarminService } from './garmin.service.js';
import type { ManualPointBody } from './garmin.types.js';

// TODO: protect mutating endpoints with an AuthGuard once the AuthModule is
// migrated (mirrors requireAuth middleware on the Express server).

@Controller()
export class GarminController {
  constructor(private readonly garminService: GarminService) {}

  /** Returns all tracking points ordered by device timestamp (ascending). */
  @Get('points')
  getPoints() {
    return this.garminService.getAllPoints();
  }

  /** Triggers a manual pull from the Garmin MapShare KML feed. */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  manualSync() {
    return this.garminService.syncFromMapShare();
  }

  /** Creates a manual waypoint (prefixed "manual-" to distinguish from device points). */
  @Post('points')
  @HttpCode(HttpStatus.OK)
  addManualPoint(@Body() body: ManualPointBody) {
    return this.garminService.addManualPoint(body);
  }

  /** Deletes a tracking point by its database ID. */
  @Delete('points/:id')
  @HttpCode(HttpStatus.OK)
  deletePoint(@Param('id', ParseIntPipe) id: number) {
    return this.garminService.deletePoint(id).then(() => ({ ok: true }));
  }

  /** Returns the last auto-sync result and polling configuration. */
  @Get('sync-status')
  getSyncStatus() {
    return this.garminService.getSyncStatus();
  }
}
