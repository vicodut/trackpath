import { Injectable } from '@nestjs/common';
import { GarminService } from '../garmin/garmin.service.js';
import { StravaService } from '../strava/strava.service.js';
import type { AdminStatus } from './admin.types.js';

@Injectable()
export class AdminService {
  private readonly pollIntervalMin: number;

  constructor(
    private readonly garminService: GarminService,
    private readonly stravaService: StravaService,
  ) {
    this.pollIntervalMin =
      parseInt(process.env.POLL_INTERVAL_MIN ?? '5', 10) || 5;
  }

  async getStatus(): Promise<AdminStatus> {
    const [lastGarmin, totalPoints, activities, connected] = await Promise.all([
      this.garminService.getLastGarminPoint(),
      this.garminService.countPoints(),
      this.stravaService.getActivities(),
      this.stravaService.isConnected(),
    ]);

    const tokens = await this.stravaService.getTokenMeta();
    const lastStrava = activities.length > 0 ? activities[activities.length - 1] : null;

    return {
      garmin: {
        configured: !!process.env.MAPSHARE_ID,
        mapshareId: process.env.MAPSHARE_ID ?? null,
        totalPoints,
        lastPointTime: lastGarmin?.timestamp ?? null,
        pollIntervalMin: this.pollIntervalMin,
      },
      strava: {
        connected,
        athleteId: tokens?.athleteId ?? null,
        totalActivities: activities.length,
        lastActivityDate: lastStrava?.startDate ?? null,
        lastActivityName: lastStrava?.name ?? null,
      },
      logs: [
        ...this.garminService.getSyncLogs(),
        ...this.stravaService.getSyncLogs(),
      ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 50),
    };
  }
}
