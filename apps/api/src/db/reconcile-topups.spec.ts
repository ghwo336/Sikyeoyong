import { afterEach, describe, expect, it } from 'vitest';
import { insertMerchant, insertUser } from '../test/fixtures.js';
import { type DbHandle, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import {
  type AllowanceEntry,
  type FundMarker,
  dbPorts,
  reconcileTopups,
} from './reconcile-topups.js';
import { orders, ownerAllowanceEntries } from './schema/index.js';

const NOW = 10_000_000;
const MIN = 60_000;
const OPTS = { olderThanMs: 30 * MIN, nowMs: NOW };

const hold = (id: string, createdAt: number): AllowanceEntry => ({
  id,
  userId: 'u1',
  kind: 'fund',
  amountAokrw: '500',
  txHash: null,
  createdAt,
});

/** A fake store: holds, the marker per hold id, and the ids that were deleted. */
function fake(holds: AllowanceEntry[], markers: Record<string, FundMarker> = {}) {
  const deleted: string[] = [];
  return {
    deleted,
    ports: {
      holdsBefore: (before: number) => holds.filter((h) => h.createdAt < before),
      markerOf: (h: AllowanceEntry) => markers[h.id] ?? null,
      release: (id: string) => {
        deleted.push(id);
        return true;
      },
    },
  };
}

describe('reconcileTopups', () => {
  it('releases an old hold whose order has no top-up marker (call never made)', () => {
    const f = fake([hold('h1', NOW - 31 * MIN)]);
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r).toEqual({ checked: 1, released: ['h1'], ambiguous: [] });
    expect(f.deleted).toEqual(['h1']);
  });

  it('only reports a hold whose marker has no hash, and never releases it', () => {
    const f = fake([hold('h1', NOW - 99 * MIN)], { h1: { orderId: 'o1', fundTxHash: null } });
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r.released).toEqual([]);
    expect(r.ambiguous).toEqual([
      {
        holdId: 'h1',
        userId: 'u1',
        amountAokrw: '500',
        orderId: 'o1',
        reason: 'marker-without-hash',
      },
    ]);
    expect(f.deleted).toEqual([]);
  });

  it('only reports a hold whose order already has a hash (only the ledger write failed)', () => {
    const f = fake([hold('h1', NOW - 99 * MIN)], { h1: { orderId: 'o1', fundTxHash: '0xab' } });
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r.ambiguous[0]?.reason).toBe('order-has-hash');
    expect(f.deleted).toEqual([]);
  });

  it('dry run lists the release but deletes nothing', () => {
    const f = fake([hold('h1', NOW - 31 * MIN)]);
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: true });
    expect(r.released).toEqual(['h1']);
    expect(f.deleted).toEqual([]);
  });

  it('skips holds younger than the bound, the boundary included', () => {
    const f = fake([hold('new', NOW - 5 * MIN), hold('edge', NOW - 30 * MIN)]);
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r).toEqual({ checked: 0, released: [], ambiguous: [] });
    expect(f.deleted).toEqual([]);
  });

  it('does not count a hold that lost the delete race as released', () => {
    const f = fake([hold('h1', NOW - 31 * MIN)]);
    const r = reconcileTopups({ ...f.ports, release: () => false }, { ...OPTS, dryRun: false });
    expect(r.released).toEqual([]);
  });
});

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

describe('reconcileTopups on the real tables (SQLite)', () => {
  function setup() {
    const h = openDb(':memory:');
    runMigrations(h.db);
    handles.push(h);
    h.sqlite.pragma('foreign_keys = OFF');
    insertUser(h.db, 'u1');
    insertMerchant(h.db, 'm1');
    const put = (e: AllowanceEntry) => h.db.insert(ownerAllowanceEntries).values(e).run();
    const marker = (id: string, startedAt: number, fundTxHash: string | null) =>
      h.db
        .insert(orders)
        .values({
          id,
          orderRef: `0x${id.padStart(64, '0')}`,
          userId: 'u1',
          agentId: 'a1',
          merchantId: 'm1',
          amountAokrw: '1',
          itemsJson: '[]',
          status: 'submitting',
          fundStartedAt: startedAt,
          fundAmountAokrw: '500',
          fundTxHash,
          createdAt: 1,
          updatedAt: 1,
        })
        .run();
    const left = () =>
      h.db
        .select()
        .from(ownerAllowanceEntries)
        .all()
        .map((e) => e.id)
        .sort();
    return { h, put, marker, left };
  }
  const run = (h: DbHandle, dryRun: boolean) =>
    reconcileTopups(dbPorts(h.db), { dryRun, olderThanMs: 30 * MIN, nowMs: NOW });
  const OLD = NOW - 60 * MIN;

  it('releases only the unmarked old fund hold and leaves every other row', () => {
    const { h, put, marker, left } = setup();
    put(hold('unmarked', OLD));
    put(hold('thrown', OLD + 1));
    marker('o1', OLD + 1, null);
    put(hold('ledger-only', OLD + 2));
    marker('o2', OLD + 2, '0xab');
    put({ ...hold('signed', OLD + 3), txHash: '0xcd' });
    put({ ...hold('young', NOW - MIN) });
    put({ ...hold('refund', OLD + 4), kind: 'refund' });
    const r = run(h, false);
    expect(r.released).toEqual(['unmarked']);
    expect(r.ambiguous.map((a) => [a.holdId, a.reason]).sort()).toEqual([
      ['ledger-only', 'order-has-hash'],
      ['thrown', 'marker-without-hash'],
    ]);
    expect(left()).toEqual(['ledger-only', 'refund', 'signed', 'thrown', 'young']);
  });

  it('a marker with another start time or amount does not hide the hold', () => {
    const { h, put, marker, left } = setup();
    put(hold('h', OLD));
    marker('o1', OLD + 1, null);
    expect(run(h, false).released).toEqual(['h']);
    expect(left()).toEqual([]);
  });

  it('dry run writes nothing', () => {
    const { h, put, left } = setup();
    put(hold('h', OLD));
    expect(run(h, true).released).toEqual(['h']);
    expect(left()).toEqual(['h']);
  });
});
