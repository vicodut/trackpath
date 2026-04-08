import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { AuthService } from './auth.service.js';

/**
 * Mirrors the Express `requireAuth` middleware:
 *   - 401 when there is no valid better-auth session
 *   - 403 when the session user is not in ADMIN_EMAILS (or ADMIN_EMAILS is
 *     empty, in which case any authenticated user is permitted)
 *
 * Apply at method level with @UseGuards(AdminGuard) on individual handlers,
 * or at controller level to protect all routes in the controller.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<IncomingMessage>();
    const session = await this.authService.getSession(request.headers);

    if (!session) {
      throw new UnauthorizedException('No valid session');
    }

    if (!this.authService.isAdmin(session.user.email)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
