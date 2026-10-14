import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AuthService } from './auth.service.js';

/**
 * Passes all /api/auth/* requests straight to better-auth's Node handler.
 * Must be applied before JSON body parsing (see AuthModule.configure).
 */
@Injectable()
export class BetterAuthMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(private readonly authService: AuthService) {
    this.handler = toNodeHandler(this.authService.instance);
  }

  use(req: IncomingMessage, res: ServerResponse, _next: () => void): void {
    void this.handler(req, res);
  }
}
