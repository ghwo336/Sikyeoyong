import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';

export type Db = BetterSQLite3Database<typeof schema>;

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
