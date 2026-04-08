import { db } from '../../db/index.js';
import { DRIZZLE } from './drizzle.constants.js';

export const drizzleProvider = {
  provide: DRIZZLE,
  useValue: db,
} as const;
