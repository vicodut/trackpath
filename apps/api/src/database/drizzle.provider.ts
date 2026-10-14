import { db } from '@trackpath/db';
import { DRIZZLE } from './drizzle.constants.js';

export const drizzleProvider = {
  provide: DRIZZLE,
  useValue: db,
} as const;
