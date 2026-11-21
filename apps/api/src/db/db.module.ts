import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';
import { type DbHandle, openDb } from './client.js';
import { ensureMigrated } from './migration-check.js';

/** Injection token for the Drizzle handle. Only repositories inject it (architecture.md). */
export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): DbHandle => {
        const handle = openDb(config.databaseUrl);
        try {
          ensureMigrated(handle.db, config.nodeEnv);
        } catch (e) {
          handle.close();
          throw e;
        }
        return handle;
      },
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  onApplicationShutdown(): void {
    this.handle.close();
  }
}
