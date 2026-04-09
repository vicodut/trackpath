import {
  Controller,
  Get,
  Post,
  Query,
  Redirect,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/admin.guard.js';
import { StravaService } from './strava.service.js';

@Controller('strava')
export class StravaController {
  constructor(private readonly stravaService: StravaService) {}

  /** Returns the Strava OAuth authorization URL. Admin-only. */
  @Get('connect')
  @UseGuards(AdminGuard)
  connect() {
    return { url: this.stravaService.getConnectUrl() };
  }

  /**
   * OAuth callback — Strava redirects here after user approves.
   * Exchanges the code for tokens then sends the user back to the app.
   */
  @Get('callback')
  @Redirect('/', 302)
  async callback(@Query('code') code: string) {
    if (!code) throw new BadRequestException('Missing OAuth code');
    const url = await this.stravaService.handleCallback(code);
    return { url };
  }

  /** Returns whether a Strava token is stored. */
  @Get('status')
  async status() {
    return { connected: await this.stravaService.isConnected() };
  }

  /** Returns all synced Strava activities ordered by start date. */
  @Get('activities')
  getActivities() {
    return this.stravaService.getActivities();
  }

  /** Triggers a manual Strava sync. Admin-only. */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async manualSync() {
    const result = await this.stravaService.syncActivities();
    if ('error' in result) throw new BadRequestException(result.error);
    const activities = await this.stravaService.getActivities();
    return { ...result, activities };
  }
}
