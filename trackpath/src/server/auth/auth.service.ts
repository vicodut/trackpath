import { Injectable, Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { db } from '../../db/index.js';
import * as schema from '../../db/schema.js';

/**
 * Inferred session type from better-auth. Typed structurally so we're not
 * coupled to a specific version of the library's exported types.
 */
export type BetterAuthSession = NonNullable<
  Awaited<ReturnType<typeof betterAuth.prototype.api.getSession>>
>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * The better-auth instance. Exposed so the middleware can hand raw
   * requests to its built-in handler without duplicating config.
   */
  readonly instance: ReturnType<typeof betterAuth>;

  private readonly adminEmails: readonly string[];

  constructor() {
    const githubId = process.env.GITHUB_CLIENT_ID;
    const githubSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!githubId || !githubSecret) {
      this.logger.warn(
        'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set — GitHub login disabled',
      );
    }

    this.instance = betterAuth({
      database: drizzleAdapter(db, { provider: 'pg', schema }),
      basePath: '/api/auth',
      trustedOrigins: [
        'http://localhost:5173',
        process.env.BETTER_AUTH_URL ?? '',
      ].filter(Boolean),
      socialProviders:
        githubId && githubSecret
          ? { github: { clientId: githubId, clientSecret: githubSecret } }
          : {},
    });

    this.adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }

  /**
   * Resolves the better-auth session from Node.js incoming headers.
   * Returns null when no valid session cookie / bearer token is present.
   */
  getSession(headers: IncomingHttpHeaders): Promise<BetterAuthSession | null> {
    return this.instance.api.getSession({ headers: fromNodeHeaders(headers) }) as Promise<BetterAuthSession | null>;
  }

  /**
   * Returns true when the email belongs to the admin list, or when the list
   * is empty (dev default: any authenticated user is an admin).
   */
  isAdmin(email: string): boolean {
    return this.adminEmails.length === 0 || this.adminEmails.includes(email);
  }
}
