// @types/pg is not installed (no new dependencies); BullMQ ships the structural pg types we need.
declare module 'pg' {
  import type { PgModule } from 'bullmq';
  const pg: PgModule;
  export default pg;
}
