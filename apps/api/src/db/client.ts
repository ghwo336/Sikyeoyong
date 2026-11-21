import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';

/** drizzle() also carries the SQLite handle ($client); runMigrations uses it for the FK pragma. */
export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export interface DbHandle {
  readonly db: Db;
  readonly sqlite: Database.Database;
  close(): void;
}

/** `file:./data/x.db` (relative to the process cwd: apps/api under pnpm) or `:memory:` (tech-spec 8.3). */
export function databasePath(url: string): string {
  if (url === ':memory:' || url === 'file::memory:') return ':memory:';
  if (!url.startsWith('file:')) {
    // Name the variable, never echo the value (it may be a credential, security.md).
    throw new AppError('INTERNAL', {
      reason: 'DATABASE_URL must be file: or :memory:',
      variables: ['DATABASE_URL'],
    });
  }
  return resolve(url.slice('file:'.length));
}

/** Opens SQLite with the settings data.md requires: WAL, foreign keys on, a busy timeout. */
export function openDb(url: string): DbHandle {
  const path = databasePath(url);
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite, close: () => sqlite.close() };
}

/** apps/api, found from this file (src/db or dist/db), so it does not depend on the process cwd. */
const API_DIR = resolve(__dirname, '../..');

/** Like databasePath, but a relative file: URL is resolved against apps/api (where the API runs). */
export function ownerDatabasePath(url: string, baseDir: string = API_DIR): string {
  const path = databasePath(url);
  if (path === ':memory:') return path;
  return resolve(baseDir, url.slice('file:'.length));
}

/**
 * Opens an existing DB for owner CLIs run from any cwd (root package.json scripts). Never creates
 * a file: a missing DB would be an empty one and the CLI would silently do nothing.
 */
export function openOwnerDb(url: string, baseDir: string = API_DIR): DbHandle {
  const path = ownerDatabasePath(url, baseDir);
  if (path !== ':memory:' && !existsSync(path)) {
    throw new Error(`DB file not found: ${path} (run pnpm db:migrate first, or fix DATABASE_URL)`);
  }
  return openDb(`file:${path}`);
}
