import {
  Global,
  Module,
} from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AdminGuard } from './admin.guard.js';
import { BetterAuthMiddleware } from './auth.middleware.js';

@Global()
@Module({
  providers: [AuthService, AdminGuard],
  // Export both so any module can inject AuthService or use AdminGuard via
  // @UseGuards(AdminGuard) without needing to import AuthModule explicitly.
  exports: [AuthService, AdminGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Route all /api/auth/* traffic to better-auth's built-in handler.
    // This must be applied before NestJS body-parsing middleware so that
    // better-auth can read the raw request body itself.
    consumer
      .apply(BetterAuthMiddleware)
      .forRoutes({ path: 'api/auth/*path', method: RequestMethod.ALL });
  }
}
