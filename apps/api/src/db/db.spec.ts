import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AppError, aokrwToString, okrwToAokrw } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { databasePath, type DbHandle, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import { menus, merchants } from './schema/index.js';

const handles: DbHandle[] = [];
function fresh(url = ':memory:'): DbHandle {
  const h = openDb(url);
  runMigrations(h.db);
  handles.push(h);
  return h;
}

afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const merchant = (id: string, payout: string) => ({
  id,
  metadataUri: `https://example.test/api/merchants/${id}/meta.json`,
  name: '가게',
  category: 'korean',
  payoutAddress: payout,
  source: 'seed' as const,
  createdAt: 1,
});

describe('databasePath', () => {
  it('maps file: urls and memory', () => {
    expect(databasePath(':memory:')).toBe(':memory:');
    expect(databasePath('file::memory:')).toBe(':memory:');
    expect(databasePath('file:./data/x.db')).toBe(resolve('./data/x.db'));
  });

  it.each(['postgres://user:secret@host/db', 'secret-token-without-colon'])(
    'rejects %j with the variable name only',
    (url) => {
      let caught: unknown;
      try {
        databasePath(url);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect((caught as AppError).detail).toEqual({
        reason: 'DATABASE_URL must be file: or :memory:',
        variables: ['DATABASE_URL'],
      });
      expect(JSON.stringify((caught as AppError).detail)).not.toContain('secret');
    },
  );
});

describe('migrations (data.md: apply to an empty DB from scratch)', () => {
  it('create the tables and can run twice', () => {
    const h = fresh();
    runMigrations(h.db);
    const tables = h.sqlite
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name not like 'sqlite%' order by name",
      )
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual([
      'agent_keys',
      'agent_limit_history',
      'agents',
      'allowed_merchants',
      'approvals',
      'chat_messages',
      'identity_checks',
      'menus',
      'merchants',
      'nag_events',
      'oauth_accounts',
      'order_events',
      'order_ratings',
      'orders',
      'owner_allowance_entries',
      'pouchi_accounts',
      'sessions',
      'users',
    ]);
  });

  it('turn on foreign keys and WAL for file databases', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sikyeoyong-db-'));
    try {
      const h = fresh(`file:${join(dir, 'nested', 't.db')}`);
      expect(h.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(h.sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(h.sqlite.pragma('busy_timeout', { simple: true })).toBe(5000);
      h.close();
      handles.pop();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('merchants and menus constraints', () => {
  it('stores money as text and reads back above 10^24 without loss', () => {
    const { db } = fresh();
    db.insert(merchants).values(merchant('m1', '0xa')).run();
    const big = aokrwToString(okrwToAokrw(10n ** 7n) * 10n ** 2n + 123n);
    db.insert(menus).values({ id: 'x', merchantId: 'm1', name: '국밥', priceAokrw: big }).run();
    const row = db.select().from(menus).where(eq(menus.id, 'x')).get();
    expect(row?.priceAokrw).toBe(big);
    expect(BigInt(row?.priceAokrw ?? '0')).toBeGreaterThan(10n ** 24n);
  });

  it.each(['0', '1', '9'.repeat(78)])('accepts price %j', (price) => {
    const { db } = fresh();
    db.insert(merchants).values(merchant('m1', '0xa')).run();
    db.insert(menus).values({ id: 'x', merchantId: 'm1', name: 'n', priceAokrw: price }).run();
    expect(db.select().from(menus).get()?.priceAokrw).toBe(price);
  });

  it('requires a metadata uri (tech-spec 4)', () => {
    const { sqlite } = fresh();
    expect(() =>
      sqlite
        .prepare(
          "insert into merchants (id, name, category, payout_address, source, created_at) values ('m9','n','c','0xz','seed',1)",
        )
        .run(),
    ).toThrow(/NOT NULL/);
  });

  it.each(['', '01', '1.5', '-1', '1e3', ' 1', '9'.repeat(79)])('rejects price %j', (price) => {
    const { db } = fresh();
    db.insert(merchants).values(merchant('m1', '0xa')).run();
    expect(() =>
      db.insert(menus).values({ id: 'x', merchantId: 'm1', name: 'n', priceAokrw: price }).run(),
    ).toThrow(/CHECK constraint failed/);
  });

  it('enforces the menu to merchant foreign key', () => {
    const { db } = fresh();
    expect(() =>
      db.insert(menus).values({ id: 'x', merchantId: 'nope', name: 'n', priceAokrw: '1' }).run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it('keeps payout addresses unique and source to seed or console', () => {
    const { db, sqlite } = fresh();
    db.insert(merchants).values(merchant('m1', '0xa')).run();
    expect(() => db.insert(merchants).values(merchant('m2', '0xa')).run()).toThrow(/UNIQUE/);
    expect(() =>
      sqlite
        .prepare(
          "insert into merchants (id, name, category, payout_address, metadata_uri, source, created_at) values ('m3','n','c','0xb','u','other',1)",
        )
        .run(),
    ).toThrow(/CHECK/);
  });
});
