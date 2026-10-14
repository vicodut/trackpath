import { Injectable, Logger } from '@nestjs/common';
import type { Session, User } from 'better-auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { auth } from '../auth.js';

/**
 * Session shape returned by better-auth's getSession(), typed against the
 * library's own exported Session/User models.
 */
export interface BetterAuthSession {
  session: Session;
  user: User;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * The better-auth instance. Shared with main.ts — do not instantiate a
   * second copy or session state will diverge.
   */
  readonly instance = auth;

  private readonly adminEmails: readonly string[];

  constructor() {
    this.adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      this.logger.warn(
        'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set — GitHub login disabled',
      );
    }
  }

  /**
   * Resolves the better-auth session from Node.js incoming headers.
   * Returns null when no valid session cookie / bearer token is present.
   */
  getSession(headers: IncomingHttpHeaders): Promise<BetterAuthSession | null> {
    return this.instance.api.getSession({
      headers: fromNodeHeaders(headers),
    });
  }

  /**
   * Returns true when the email belongs to the admin list, or when the list
   * is empty (dev default: any authenticated user is an admin).
   */
  isAdmin(email: string): boolean {
    return this.adminEmails.length === 0 || this.adminEmails.includes(email);
  }
}
