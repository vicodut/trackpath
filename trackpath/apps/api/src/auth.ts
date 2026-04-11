import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@trackpath/db";
import * as schema from "@trackpath/db/schema";

const githubId = process.env.GITHUB_CLIENT_ID;
const githubSecret = process.env.GITHUB_CLIENT_SECRET;

if (!githubId || !githubSecret) {
  console.warn('WARNING: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set. GitHub login will be disabled.');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  basePath: "/api/auth",
  trustedOrigins: [
    "http://localhost:5173",
    process.env.BETTER_AUTH_URL ?? "",
  ].filter(Boolean),
  socialProviders: githubId && githubSecret ? {
    github: {
      clientId: githubId,
      clientSecret: githubSecret,
    },
  } : {},
});
