import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AdminGuard } from './admin.guard.js';

@Global()
@Module({
  providers: [AuthService, AdminGuard],
  exports: [AuthService, AdminGuard],
})
export class AuthModule {}
