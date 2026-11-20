import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError, parseMerchantOnchain } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import {
  onchainRecordPath,
  readOnchainRecord,
  syncFromRecordFile,
  syncOnchainIds,
} from './merchant-onchain-sync.js';
import { merchants } from './schema/index.js';

const cleanup: (() => void)[] = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

function freshDb(): DbHandle {
  const h = openDb(':memory:');
  runMigrations(h.db);
  cleanup.push(() => {
    h.close();
  });
  return h;
}

const CHAIN = 31337;
const A = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
const B = `0x${'b'.repeat(40)}`;
const h = (c: string) => `0x${c.repeat(64)}`;
const entry = (key: string, id: string, payout: string) => ({
  merchantKey: key,
  onchainId: id,
  payout,
  metadataUri: 'http://x/meta.json',
  txs: { fund: null, register: h('b'), activate: h('c') },
  blocks: { register: 1, activate: 2 },
});
const record = (entries: ReturnType<typeof entry>[]) =>
  parseMerchantOnchain({
    chainId: CHAIN,
    profile: 'demo',
    proxy: `0x${'1'.repeat(40)}`,
    merchants: entries,
  });

function insert(db: DbHandle, id: string, payout: string, onchainId: string | null = null) {
  db.db
    .insert(merchants)
    .values({
      id,
      name: id,
      category: 'c',
      payoutAddress: payout,
      onchainId,
      metadataUri: 'http://x',
      source: 'seed',
      createdAt: 1,
    })
    .run();
}
const idOf = (db: DbHandle, id: string) =>
  db.db.select({ o: merchants.onchainId }).from(merchants).where(eq(merchants.id, id)).get()?.o;

describe('syncOnchainIds', () => {
  it('sets ids by payout address, ignoring address case', () => {
    const db = freshDb();
    insert(db, 'm1', A);
    const r = syncOnchainIds(db.db, record([entry('a', '7', A.toLowerCase())]));
    expect(r).toEqual({ updated: 1, unchanged: 0, missing: 0 });
    expect(idOf(db, 'm1')).toBe('7');
  });

  it('is idempotent', () => {
    const db = freshDb();
    insert(db, 'm1', A);
    const rec = record([entry('a', '7', A)]);
    syncOnchainIds(db.db, rec);
    expect(syncOnchainIds(db.db, rec)).toEqual({ updated: 0, unchanged: 1, missing: 0 });
  });

  it('counts record entries that are not in the DB', () => {
    const db = freshDb();
    insert(db, 'm1', A);
    const r = syncOnchainIds(db.db, record([entry('a', '1', A), entry('b', '2', B)]));
    expect(r).toEqual({ updated: 1, unchanged: 0, missing: 1 });
  });

  it('stops on a different existing id and changes nothing', () => {
    const db = freshDb();
    insert(db, 'm1', A, '9');
    insert(db, 'm2', B);
    expect(() => syncOnchainIds(db.db, record([entry('b', '2', B), entry('a', '1', A)]))).toThrow(
      AppError,
    );
    expect(idOf(db, 'm2')).toBeNull();
    expect(idOf(db, 'm1')).toBe('9');
  });
});

describe('record file', () => {
  it('reads nothing when the file is absent and parses one when present', () => {
    const root = mkdtempSync(join(tmpdir(), 'onchain-sync-'));
    cleanup.push(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const db = freshDb();
    expect(syncFromRecordFile(db.db, root, CHAIN, 'demo')).toBeNull();
    mkdirSync(join(root, 'seed/onchain'), { recursive: true });
    writeFileSync(
      onchainRecordPath(root, CHAIN, 'demo'),
      JSON.stringify(record([entry('a', '3', A)])),
    );
    expect(readOnchainRecord(onchainRecordPath(root, CHAIN, 'demo'))?.merchants).toHaveLength(1);
    insert(db, 'm1', A);
    expect(syncFromRecordFile(db.db, root, CHAIN, 'demo')?.updated).toBe(1);
  });

  it('rejects a malformed record', () => {
    const root = mkdtempSync(join(tmpdir(), 'onchain-sync-'));
    cleanup.push(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, 'seed/onchain'), { recursive: true });
    writeFileSync(onchainRecordPath(root, CHAIN, 'demo'), '{"chainId": 1}');
    expect(() => readOnchainRecord(onchainRecordPath(root, CHAIN, 'demo'))).toThrow();
  });

  it('rejects a record whose chain id differs from its file name', () => {
    const root = mkdtempSync(join(tmpdir(), 'onchain-sync-'));
    cleanup.push(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, 'seed/onchain'), { recursive: true });
    writeFileSync(
      onchainRecordPath(root, CHAIN + 1, 'demo'),
      JSON.stringify(record([entry('a', '3', A)])),
    );
    expect(() => readOnchainRecord(onchainRecordPath(root, CHAIN + 1, 'demo'))).toThrow(AppError);
  });
});
