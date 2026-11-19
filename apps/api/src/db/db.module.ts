import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';
import { type DbHandle, openDb } from './client.js';

/** Injection token for the Drizzle handle. Only repositories inject it (architecture.md). */
export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): DbHandle => openDb(config.databaseUrl),
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
