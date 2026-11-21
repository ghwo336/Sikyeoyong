import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import type { Db } from './client.js';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate.js';

interface JournalEntry {
  readonly tag: string;
  readonly when: number;
}

/**
 * Tags of the migrations in the folder that the database has not run yet. Same rule as Drizzle's
 * migrator: an entry is pending when its journal time is later than the newest applied one
 * (no `__drizzle_migrations` table yet means all of them).
 */
export function pendingMigrations(db: Db, folder: string = MIGRATIONS_FOLDER): string[] {
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: JournalEntry[];
  };
  const sqlite = db.$client;
  const hasTable =
    sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
      .get() !== undefined;
  const last = hasTable
    ? (
        sqlite
          .prepare(
            'SELECT created_at AS at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
          )
          .get() as { at: number | bigint } | undefined
      )?.at
    : undefined;
  return journal.entries
    .filter((e) => last === undefined || e.when > Number(last))
    .map((e) => e.tag);
}

/**
 * Boot check (QA: a pending migration made every route a 500). Production refuses to start and
 * says which migrations and the command, because schema changes there are the owner's step
 * (`pnpm db:migrate`), never a side effect of starting. Development and test apply them, so a
 * local database never lags behind the code.
 */
export function ensureMigrated(
  db: Db,
  nodeEnv: 'development' | 'test' | 'production',
  folder: string = MIGRATIONS_FOLDER,
): void {
  const pending = pendingMigrations(db, folder);
  if (pending.length === 0) return;
  if (nodeEnv === 'production') {
    // A plain Error on purpose: the message is what the owner reads in the boot log.
    throw new Error(
      `Database is behind the code: ${pending.length} migration(s) pending (${pending.join(', ')}). Run "pnpm db:migrate" and start again.`,
    );
  }
  if (nodeEnv === 'development') {
    new Logger('Migrations').log(`applying ${pending.length} pending: ${pending.join(', ')}`);
  }
  runMigrations(db);
}
