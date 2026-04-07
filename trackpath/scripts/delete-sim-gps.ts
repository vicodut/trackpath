import 'dotenv/config';
import { db } from '../src/db/index.js';
import { trackingPoints } from '../src/db/schema.js';
import { like } from 'drizzle-orm';

const result = await db.delete(trackingPoints).where(like(trackingPoints.garminId, 'sim-%'));
console.log('Deleted simulated GPS points.');
process.exit(0);
