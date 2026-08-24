-- Custom SQL migration file, put your code below! --

-- better-auth 1.7.1 (upgraded from 1.5.6 to fix GHSA-g38m-r43w-p2q7, an OAuth
-- account-takeover CVE) added a required `issuer` column to the account model,
-- used instead of the raw provider_id to look up accounts. It's a synthetic,
-- namespaced key: OAuth-linked accounts (this app only configures GitHub
-- OAuth — see apps/api/src/auth.ts) get `local:oauth:<providerId>`, matching
-- better-auth's own createOAuthAccountIssuer() format.
-- Re-runnable: only backfills rows where issuer is still null.
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" text;

UPDATE "account"
SET "issuer" = 'local:oauth:' || "provider_id"
WHERE "issuer" IS NULL;

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;
