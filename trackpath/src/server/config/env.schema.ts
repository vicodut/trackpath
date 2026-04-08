import { z } from 'zod';

/**
 * Canonical environment schema for the NestJS server.
 * Validated once at startup via ConfigModule — the app refuses to boot with
 * missing or malformed values rather than failing at the first DB call.
 */
export const envSchema = z.object({
  // ── Database ──────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Auth ──────────────────────────────────────────────────────────────────
  BETTER_AUTH_SECRET: z.string().min(16, 'BETTER_AUTH_SECRET must be at least 16 characters'),
  BETTER_AUTH_URL: z.string().url().optional(),
  ADMIN_EMAILS: z.string().optional(),

  // ── GitHub OAuth (optional — disables GitHub login when absent) ───────────
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // ── Garmin inReach ────────────────────────────────────────────────────────
  MAPSHARE_ID: z.string().optional(),
  POLL_INTERVAL_MIN: z.coerce.number().int().positive().default(5),

  // ── Strava ────────────────────────────────────────────────────────────────
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),

  // ── Ghost CMS (blog proxy) ────────────────────────────────────────────────
  GHOST_URL: z.string().url().optional(),
  GHOST_CONTENT_API_KEY: z.string().optional(),

  // ── Server ────────────────────────────────────────────────────────────────
  PORT: z.coerce.number().int().positive().default(3000),
  NEST_PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Passed to ConfigModule.forRoot({ validate }).
 * Throws on the first validation failure so the error is visible immediately
 * in the boot log rather than surfacing later as a confusing runtime crash.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(`Environment validation failed:\n${lines.join('\n')}`);
  }
  return result.data;
}
