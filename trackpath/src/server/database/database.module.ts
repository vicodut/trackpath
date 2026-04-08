import { Global, Module } from '@nestjs/common';
import { drizzleProvider } from './drizzle.provider.js';
import { sqlClientProvider } from './sql-client.provider.js';

@Global()
@Module({
  providers: [drizzleProvider, sqlClientProvider],
  exports: [drizzleProvider, sqlClientProvider],
})
export class DatabaseModule {}
