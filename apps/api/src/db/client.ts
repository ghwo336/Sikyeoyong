import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';

export type Db = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
  readonly db: Db;
  readonly sqlite: Database.Database;
  close(): void;
}

/** `file:./data/x.db` or `:memory:` (tech-spec 8.3 DATABASE_URL). */
export function databasePath(url: string): string {
  if (url === ':memory:' || url === 'file::memory:') return ':memory:';
  if (!url.startsWith('file:')) {
    throw new Error(
      `DATABASE_URL must start with file: or be :memory: (got scheme of ${url.split(':')[0] ?? ''})`,
    );
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
