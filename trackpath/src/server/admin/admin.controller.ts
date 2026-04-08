import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { AdminService } from './admin.service.js';

@Controller()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Returns the current user + admin flag.
   * Public — returns { user: null, isAdmin: false } when unauthenticated.
   */
  @Get('me')
  async me(@Req() req: IncomingMessage) {
    const session = await this.authService.getSession(req.headers);
    if (!session) return { user: null, isAdmin: false };
    return {
      user: session.user,
      isAdmin: this.authService.isAdmin(session.user.email),
    };
  }

  /** Aggregated admin dashboard data. Admin-only. */
  @Get('admin/status')
  @UseGuards(AdminGuard)
  getStatus() {
    return this.adminService.getStatus();
  }
}
