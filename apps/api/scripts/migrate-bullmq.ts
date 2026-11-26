import 'dotenv/config';
import pg from 'pg';
import { runMigrations } from 'bullmq';

// Creates BullMQ's own tables (schema "bullmq"); idempotent and advisory-locked.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await runMigrations(client);
  console.log('BullMQ migrations applied');
} finally {
  client.release();
  await pool.end();
}
