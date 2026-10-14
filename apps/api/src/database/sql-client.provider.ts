import { sql } from '@trackpath/db';
import { SQL_CLIENT } from './drizzle.constants.js';

/**
 * Exposes the raw postgres-js tagged-template client for the rare cases where
 * plain Drizzle queries are insufficient (e.g. multi-statement transactions or
 * raw DDL that Drizzle doesn't model).
 */
export const sqlClientProvider = {
  provide: SQL_CLIENT,
  useValue: sql,
} as const;
