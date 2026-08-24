import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  // better-auth must intercept /api/auth/* before body-parsing.
  app.use('/api/auth', toNodeHandler(auth));

  if (process.env.NODE_ENV === 'production') {
    const clientDir = join(__dirname, 'client');

    // Serve hashed static assets (JS/CSS/images) — only fires when the file exists.
    app.use(express.static(clientDir));

    // SPA fallback: serve index.html for any non-API path so that client-side
    // routing works. Registered before NestJS routes so it wins over NestJS's
    // own 404 handler for unmatched routes.
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api/')) { next(); return; }
      res.sendFile(join(clientDir, 'index.html'));
    });
  }

  // Body parsing for all other routes.
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Strip unknown fields and auto-coerce primitives (e.g. query strings to numbers).
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');

  // Railway sets PORT; fall back to NEST_PORT for local dev.
  // NEST_PORT (set in .env for local dev) takes priority over PORT.
  // In production Railway sets PORT; NEST_PORT is not set there so PORT wins.
  const port = process.env.NEST_PORT ?? process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`NestJS listening on :${port}`);
}

bootstrap();
