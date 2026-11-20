import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import { menus, merchants } from './schema/index.js';
import { ensurePayoutKeys, parseSeed, type SeedFile, seedMerchants } from './seed.js';

const REAL_SEED = resolve(__dirname, '../../../../seed/merchants.json');
const seed = parseSeed(JSON.parse(readFileSync(REAL_SEED, 'utf8')));
// verify-allow: R4 independent oracle for expected values, not production code
const won = (n: bigint) => (n * 10n ** 18n).toString();

const cleanup: (() => void)[] = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sikyeoyong-seed-'));
  cleanup.push(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function freshDb(): DbHandle {
  const h = openDb(':memory:');
  runMigrations(h.db);
  cleanup.push(() => {
    h.close();
  });
  return h;
}

describe('seed/merchants.json (tech-spec 7.1 table)', () => {
  it('starts with the eight tech-spec merchants; every merchant but the fake one is verified', () => {
    expect(seed.merchants.slice(0, 8).map((m) => m.key)).toEqual([
      'gukbap-01',
      'chicken-01',
      'bunsik-01',
      'jjajang-01',
      'pizza-01',
      'salad-01',
      'bossam-01',
      'fake-01',
    ]);
    expect(seed.merchants.filter((m) => !m.verified).map((m) => m.key)).toEqual(['fake-01']);
    // A wide mock market (2026-11-21): enough stores that recommendations are never empty.
    expect(seed.merchants.length).toBeGreaterThanOrEqual(60);
    expect(seed.merchants.find((m) => m.key === 'fake-01')?.verified).toBe(false);
  });

  it('keeps the demo prices: 45,000 bossam for scene 4 and 1,000 fake menu', () => {
    const price = (mk: string, menu: string) =>
      seed.merchants.find((m) => m.key === mk)?.menus.find((x) => x.key === menu)?.price;
    expect(price('bossam-01', 'bossam-large')).toBe(45_000);
    expect(price('gukbap-01', 'dwaeji')).toBe(9_000);
    expect(price('fake-01', 'anything')).toBe(1_000);
  });
});

describe('parseSeed', () => {
  const base = {
    version: 1,
    merchants: [
      {
        key: 'a',
        name: 'n',
        category: 'c',
        tags: [],
        verified: true,
        openHours: {},
        menus: [{ key: 'm', name: 'x', price: 1, tags: [] }],
      },
    ],
  };

  it.each([
    [
      'fractional price',
      {
        ...base,
        merchants: [
          { ...base.merchants[0], menus: [{ key: 'm', name: 'x', price: 1.5, tags: [] }] },
        ],
      },
    ],
    [
      'zero price',
      {
        ...base,
        merchants: [{ ...base.merchants[0], menus: [{ key: 'm', name: 'x', price: 0, tags: [] }] }],
      },
    ],
    ['no menus', { ...base, merchants: [{ ...base.merchants[0], menus: [] }] }],
    ['bad key', { ...base, merchants: [{ ...base.merchants[0], key: 'A B' }] }],
    ['wrong version', { ...base, version: 2 }],
  ])('rejects %s', (_name, json) => {
    expect(() => parseSeed(json)).toThrow();
  });

  it('rejects duplicate menu keys within a merchant', () => {
    const m = base.merchants[0];
    expect(() =>
      parseSeed({
        ...base,
        merchants: [{ ...m, menus: [...(m?.menus ?? []), ...(m?.menus ?? [])] }],
      }),
    ).toThrow(AppError);
  });

  it('rejects duplicate merchant keys', () => {
    expect(() => parseSeed({ ...base, merchants: [base.merchants[0], base.merchants[0]] })).toThrow(
      AppError,
    );
  });
});

describe('ensurePayoutKeys', () => {
  it('creates one key per merchant, mode 600, and reuses them on the next run', () => {
    const file = join(tempDir(), '.keys', 'merchants.json');
    const first = ensurePayoutKeys(file, ['a', 'b']);
    expect([...first.values()].every((a) => /^0x[0-9a-fA-F]{40}$/.test(a))).toBe(true);
    expect(new Set(first.values()).size).toBe(2);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const second = ensurePayoutKeys(file, ['a', 'b', 'c']);
    expect(second.get('a')).toBe(first.get('a'));
    expect(second.get('b')).toBe(first.get('b'));
    expect(second.size).toBe(3);
  });

  it.each([
    ['truncated JSON', (k: string) => `{"a":{"privateKey":"${k}`],
    ['wrong shape', (k: string) => JSON.stringify({ a: { privateKey: k.toUpperCase() } })],
    // An unexpected token makes JSON.parse quote the source around it (the leak case).
    [
      'single quotes',
      (k: string) => JSON.stringify({ a: { privateKey: k } }).replace(':"0x', ":'0x"),
    ],
  ])('never puts key material in the error for a broken key file (%s)', (_name, broken) => {
    const file = join(tempDir(), 'k.json');
    ensurePayoutKeys(file, ['a']);
    const key =
      (JSON.parse(readFileSync(file, 'utf8')) as Record<string, { privateKey: string }>).a
        ?.privateKey ?? '';
    writeFileSync(file, broken(key));
    let caught: unknown;
    try {
      ensurePayoutKeys(file, ['a']);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    const text =
      `${String(caught)} ${(caught as Error).message} ${JSON.stringify((caught as AppError).detail)} ${String((caught as AppError).cause)}`.toLowerCase();
    // No 6-character window of the key may appear anywhere in the error.
    const hex = key.slice(2).toLowerCase();
    const leaked = Array.from({ length: hex.length - 5 }, (_, i) => hex.slice(i, i + 6)).filter(
      (w) => text.includes(w),
    );
    expect(leaked).toEqual([]);
  });

  it('reports an unreadable key file without its contents or cause', () => {
    const file = join(tempDir(), 'k.json');
    mkdirSync(file); // a directory where the file should be
    let caught: unknown;
    try {
      ensurePayoutKeys(file, ['a']);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).detail).toEqual({
      reason: 'payout key file cannot be read',
      path: file,
    });
    expect((caught as AppError).cause).toBeUndefined();
  });

  it('leaves no temp file behind', () => {
    const dir = tempDir();
    ensurePayoutKeys(join(dir, 'k.json'), ['a']);
    expect(readdirSync(dir).sort()).toEqual(['archive', 'k.json']);
  });

  it('returns addresses only, never the private keys', () => {
    const file = join(tempDir(), 'k.json');
    const out = ensurePayoutKeys(file, ['a']);
    const stored = (
      JSON.parse(readFileSync(file, 'utf8')) as Record<string, { privateKey: string }>
    ).a;
    expect(JSON.stringify([...out])).not.toContain(stored?.privateKey.slice(2) ?? 'x');
  });
});

describe('seedMerchants', () => {
  const payouts = (s: SeedFile) =>
    new Map(s.merchants.map((m, i) => [m.key, `0x${(i + 1).toString(16).padStart(40, '0')}`]));

  it('loads merchants and menus with aokrw prices and metadata uris', () => {
    const { db } = freshDb();
    expect(seedMerchants(db, seed, payouts(seed), 'http://localhost:3000/', 1_000)).toEqual({
      inserted: seed.merchants.length,
      skipped: 0,
    });
    const rows = db.select().from(merchants).all();
    expect(rows).toHaveLength(seed.merchants.length);
    const fake = rows.find((r) => r.name === '초특가 아무거나');
    expect(fake?.verified).toBe(false);
    expect(fake?.onchainId).toBeNull();
    expect(rows.every((r) => r.source === 'seed' && r.createdAt === 1_000)).toBe(true);
    expect(rows[0]?.metadataUri).toBe(
      `http://localhost:3000/api/merchants/${rows[0]?.id ?? ''}/meta.json`,
    );
    const large = db
      .select()
      .from(menus)
      .all()
      .find((m) => m.name === '보쌈 대(大)');
    expect(large?.priceAokrw).toBe(won(45_000n));
    expect(db.select().from(menus).all()).toHaveLength(
      seed.merchants.reduce((n, m) => n + m.menus.length, 0),
    );
  });

  it('gives ids that sort in insert order within one run', () => {
    const { db, sqlite } = freshDb();
    seedMerchants(db, seed, payouts(seed), 'http://x', 5_000);
    // Read in physical insert order (rowid), independent of any index on id.
    const rows = sqlite.prepare('select id, name from merchants order by rowid').all() as {
      id: string;
      name: string;
    }[];
    expect(rows.map((r) => r.name)).toEqual(seed.merchants.map((m) => m.name));
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual([...ids].sort());
    const menuIds = (
      sqlite.prepare('select id from menus order by rowid').all() as { id: string }[]
    ).map((r) => r.id);
    expect(menuIds).toEqual([...menuIds].sort());
  });

  it('is idempotent: a second run skips every merchant and adds no menus', () => {
    const { db } = freshDb();
    seedMerchants(db, seed, payouts(seed), 'http://x');
    const menuCount = db.select().from(menus).all().length;
    expect(seedMerchants(db, seed, payouts(seed), 'http://x')).toEqual({
      inserted: 0,
      skipped: seed.merchants.length,
    });
    expect(db.select().from(menus).all()).toHaveLength(menuCount);
  });

  it('writes nothing when one merchant fails (single transaction)', () => {
    const { db } = freshDb();
    const partial = payouts(seed);
    partial.delete('fake-01');
    expect(() => seedMerchants(db, seed, partial, 'http://x')).toThrow(AppError);
    expect(db.select().from(merchants).all()).toHaveLength(0);
  });
});
