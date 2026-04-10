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
  Sse,
  Res,
  MessageEvent,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard.js';
import { GarminService } from './garmin.service.js';
import { ManualPointDto } from './garmin.dto.js';

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
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  manualSync() {
    return this.garminService.syncFromMapShare();
  }

  /** Creates a manual waypoint (prefixed "manual-" to distinguish from device points). */
  @Post('points')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  addManualPoint(@Body() body: ManualPointDto) {
    return this.garminService.addManualPoint(body);
  }

  /** Deletes a tracking point by its database ID. */
  @Delete('points/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  deletePoint(@Param('id', ParseIntPipe) id: number) {
    return this.garminService.deletePoint(id).then(() => ({ ok: true }));
  }

  /** Returns the last auto-sync result and polling configuration. */
  @Get('sync-status')
  getSyncStatus() {
    return this.garminService.getSyncStatus();
  }

  /** SSE stream: pushes all points on connect and after each sync that adds new points. */
  @Get('stream')
  @Sse()
  stream(): Observable<MessageEvent> {
    return this.garminService.getPointsStream() as Observable<MessageEvent>;
  }

  /** Downloads all tracking points as a GPX 1.1 file. */
  @Get('export.gpx')
  async exportGpx(@Res() res: Response) {
    const points = await this.garminService.getAllPoints();
    const xml = this.garminService.buildGpx(points);
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="trackpath.gpx"');
    res.send(xml);
  }
}
