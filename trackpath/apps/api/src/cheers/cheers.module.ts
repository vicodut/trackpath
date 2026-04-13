import { Module } from '@nestjs/common';
import { CheersController } from './cheers.controller.js';
import { CheersService } from './cheers.service.js';

@Module({
  controllers: [CheersController],
  providers: [CheersService],
})
export class CheersModule {}
