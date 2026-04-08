import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express, { json, urlencoded } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from './app.module.js';
import { auth } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function bootstrap() {
  // Disable NestJS built-in body parsing so better-auth can read raw request
  // bodies itself before any JSON parser runs.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Mount better-auth before body-parsing middleware. Express app.use() does
  // prefix matching, so this catches /api/auth and /api/auth/* without needing
  // wildcard gymnastics.
  app.use('/api/auth', toNodeHandler(auth));

  // Re-enable body parsing for all other routes.
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.setGlobalPrefix('api');

  // Explicitly init so all NestJS routes are registered before we add the
  // SPA catch-all below (which must come last in the middleware chain).
  await app.init();

  if (process.env.NODE_ENV === 'production') {
    const clientDir = join(__dirname, '../../dist/client');
    const expressApp = app.getHttpAdapter().getInstance() as express.Application;
    expressApp.use(express.static(clientDir));
    expressApp.get('*', (_req: express.Request, res: express.Response) => {
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  // Railway sets PORT; fall back to NEST_PORT for local dev.
  const port = process.env.PORT ?? process.env.NEST_PORT ?? 3001;
  await app.listen(port);
  console.log(`NestJS listening on :${port}`);
}

bootstrap();
