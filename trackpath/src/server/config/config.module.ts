import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema.js';

/**
 * Wraps @nestjs/config with Zod validation.
 * Import this as the FIRST module in AppModule so all other modules can rely
 * on the env being valid before their providers are instantiated.
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,      // ConfigService available everywhere without re-importing
      cache: true,         // process.env lookups are cached after first read
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
