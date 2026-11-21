import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from './client.js';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate.js';
import { ensureMigrated, pendingMigrations } from './migration-check.js';

const handles: DbHandle[] = [];
const dirs: string[] = [];
function open(url = ':memory:'): DbHandle {
  const h = openDb(url);
  handles.push(h);
  return h;
}
afterEach(() => {
  while (handles.length) handles.pop()?.close();
  while (dirs.length) rmSync(dirs.pop() ?? '', { recursive: true, force: true });
});

// 0017 (chat sessions) is the migration QA found pending. A database "behind" it has none of
// the migrations from 0017 on in its record and none of 0017's column.
const JOURNAL = (
  JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8')) as {
    entries: { tag: string; when: number }[];
  }
).entries;
const FROM_0017 = JOURNAL.filter((e) => e.tag >= '0017').map((e) => e.tag);
const WHEN_0017 = JOURNAL.find((e) => e.tag.startsWith('0017'))?.when ?? 0;

const hasSessionColumn = (h: DbHandle) =>
  (h.sqlite.prepare('PRAGMA table_info(chat_messages)').all() as { name: string }[]).some(
    (c) => c.name === 'session_id',
  );

/**  */
function behind(): DbHandle {
  const h = open();
  runMigrations(h.db);
  h.sqlite.prepare('DELETE FROM "__drizzle_migrations" WHERE created_at >= ?').run(WHEN_0017);
  h.sqlite.exec('DROP INDEX chat_messages_session_idx');
  h.sqlite.exec('ALTER TABLE chat_messages DROP COLUMN session_id');
  return h;
}

describe('pendingMigrations', () => {
  it('a new database has every migration pending, a migrated one has none', () => {
    const h = open();
    expect(pendingMigrations(h.db).length).toBeGreaterThan(10);
    runMigrations(h.db);
    expect(pendingMigrations(h.db)).toEqual([]);
  });

  it('names the ones after the newest applied', () => {
    expect(pendingMigrations(behind().db)).toEqual(FROM_0017);
  });
});

describe('ensureMigrated', () => {
  it('production refuses, names the migration and the command, and changes nothing', () => {
    const h = behind();
    expect(() => {
      ensureMigrated(h.db, 'production');
    }).toThrow(/0017_chat_session.*pnpm db:migrate/);
    expect(pendingMigrations(h.db)).toEqual(FROM_0017);
    expect(hasSessionColumn(h)).toBe(false);
  });

  it.each(['development', 'test'] as const)('%s applies the pending ones', (env) => {
    const h = behind();
    ensureMigrated(h.db, env);
    expect(pendingMigrations(h.db)).toEqual([]);
    expect(hasSessionColumn(h)).toBe(true);
  });

  it('does nothing, in any environment, when the database is current', () => {
    const h = open();
    runMigrations(h.db);
    for (const env of ['development', 'test', 'production'] as const) {
      expect(() => {
        ensureMigrated(h.db, env);
      }).not.toThrow();
    }
  });

  it('a file database that never ran a migration is refused in production too', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-'));
    dirs.push(dir);
    const h = open(`file:${join(dir, 'x.db')}`);
    expect(() => {
      ensureMigrated(h.db, 'production');
    }).toThrow(/pending/);
  });
});
