import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { loadConfig } from '../config/env.js';
import { type Db, openDb } from './client.js';

/** Migrations sit next to this file in src and are copied next to it in dist (build script). */
export const MIGRATIONS_FOLDER = resolve(__dirname, 'migrations');

/**
 * Runs pending migrations with foreign keys off, then checks them (SQLite's table rebuild
 * procedure). The migrator wraps everything in one transaction, where the migrations' own
 * `PRAGMA foreign_keys=OFF` is a no-op, so rebuilding a table other rows point at (0009 agents,
 * users) would fail on a database that has data. Any dangling reference after the run throws.
 */
export function runMigrations(db: Db): void {
  const sqlite = db.$client;
  const wasOn = sqlite.pragma('foreign_keys', { simple: true }) === 1;
  sqlite.pragma('foreign_keys = OFF');
  try {
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const broken = sqlite.pragma('foreign_key_check') as unknown[];
    if (broken.length > 0) {
      throw new AppError('INTERNAL', {
        reason: 'migrations left broken foreign keys',
        count: broken.length,
      });
    }
  } finally {
    if (wasOn) sqlite.pragma('foreign_keys = ON');
  }
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
