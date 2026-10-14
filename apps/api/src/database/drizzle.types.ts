import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '@trackpath/db/schema';

export type DrizzleClient = PostgresJsDatabase<typeof schema>;
