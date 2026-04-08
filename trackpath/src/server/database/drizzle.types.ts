import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../../db/schema.js';

export type DrizzleClient = PostgresJsDatabase<typeof schema>;
