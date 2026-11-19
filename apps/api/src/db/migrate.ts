import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { loadConfig } from '../config/env.js';
import { type Db, openDb } from './client.js';

/** Migrations sit next to this file in src and are copied next to it in dist (build script). */
export const MIGRATIONS_FOLDER = resolve(__dirname, 'migrations');

export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

// `pnpm db:migrate` entry. Reads the same root .env as the server.
if (require.main === module) {
  const envFile = resolve(__dirname, '../../../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const handle = openDb(loadConfig(process.env).databaseUrl);
  runMigrations(handle.db);
  handle.close();
  console.warn('migrations applied');
}
