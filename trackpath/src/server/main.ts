import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  const port = process.env.NEST_PORT ?? 3001;
  await app.listen(port);
  console.log(`NestJS listening on :${port}`);
}

bootstrap();
