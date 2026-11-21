import { afterEach, describe, expect, it } from 'vitest';
import { insertMerchant, insertUser } from '../test/fixtures.js';
import { type DbHandle, openDb } from './client.js';
import { runMigrations } from './migrate.js';
import { type AllowanceEntry, dbPorts, reconcileTopups } from './reconcile-topups.js';
import { orders, ownerAllowanceEntries } from './schema/index.js';

const NOW = 10_000_000;
const MIN = 60_000;
const OPTS = { olderThanMs: 30 * MIN, nowMs: NOW };

const hold = (
  id: string,
  createdAt: number,
  over: Partial<AllowanceEntry> = {},
): AllowanceEntry => ({
  id,
  userId: 'u1',
  kind: 'fund',
  amountAokrw: '500',
  txHash: null,
  createdAt,
  orderId: 'o1',
  fundCallStartedAt: null,
  ...over,
});

/** A fake store: holds and the ids that were deleted. */
function fake(holds: AllowanceEntry[]) {
  const deleted: string[] = [];
  return {
    deleted,
    ports: {
      holdsBefore: (before: number) => holds.filter((h) => h.createdAt < before),
      release: (id: string) => {
        deleted.push(id);
        return true;
      },
    },
  };
}

describe('reconcileTopups', () => {
  it('releases an old linked hold whose fund call never started', () => {
    const f = fake([hold('h1', NOW - 31 * MIN)]);
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r).toEqual({ checked: 1, released: ['h1'], ambiguous: [] });
    expect(f.deleted).toEqual(['h1']);
  });

  it('only reports a hold whose fund call started, and never releases it', () => {
    const f = fake([hold('h1', NOW - 99 * MIN, { fundCallStartedAt: 5 })]);
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r.released).toEqual([]);
    expect(r.ambiguous).toEqual([
      {
        holdId: 'h1',
        userId: 'u1',
        amountAokrw: '500',
        orderId: 'o1',
        reason: 'fund-call-started',
      },
    ]);
    expect(f.deleted).toEqual([]);
  });

  it('only reports a hold without an order link (row from before the column)', () => {
    const f = fake([hold('h1', NOW - 99 * MIN, { orderId: null })]);
    const r = reconcileTopups(f.ports, { ...OPTS, dryRun: false });
    expect(r.ambiguous[0]?.reason).toBe('no-order-link');
    expect(r.released).toEqual([]);
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
    h.db
      .insert(orders)
      .values({
        id: 'o1',
        orderRef: `0x${'1'.padStart(64, '0')}`,
        userId: 'u1',
        agentId: 'a1',
        merchantId: 'm1',
        amountAokrw: '1',
        itemsJson: '[]',
        status: 'submitting',
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    const put = (e: AllowanceEntry) => h.db.insert(ownerAllowanceEntries).values(e).run();
    const left = () =>
      h.db
        .select()
        .from(ownerAllowanceEntries)
        .all()
        .map((e) => e.id)
        .sort();
    return { h, put, left };
  }
  const run = (h: DbHandle, dryRun: boolean) =>
    reconcileTopups(dbPorts(h.db), { dryRun, olderThanMs: 30 * MIN, nowMs: NOW });
  const OLD = NOW - 60 * MIN;

  it('releases only the unstarted linked hold and leaves every other row', () => {
    const { h, put, left } = setup();
    put(hold('unstarted', OLD));
    put(hold('started', OLD + 1, { fundCallStartedAt: OLD + 1 }));
    put(hold('legacy', OLD + 2, { orderId: null }));
    put(hold('signed', OLD + 3, { txHash: '0xcd' }));
    put(hold('young', NOW - MIN));
    put(hold('refund', OLD + 4, { kind: 'refund' }));
    const r = run(h, false);
    expect(r.released).toEqual(['unstarted']);
    expect(r.ambiguous.map((a) => [a.holdId, a.reason]).sort()).toEqual([
      ['legacy', 'no-order-link'],
      ['started', 'fund-call-started'],
    ]);
    expect(left()).toEqual(['legacy', 'refund', 'signed', 'started', 'young']);
  });

  it('a started hold stays when the order marker was overwritten or cleared later', () => {
    const { h, put, left } = setup();
    // Top-up 1 reached the call and its hash never settled the hold.
    put(hold('first', OLD, { fundCallStartedAt: OLD }));
    // Top-up 2 on the same order overwrote the marker with its own start...
    h.db
      .update(orders)
      .set({ fundStartedAt: OLD + 5, fundAmountAokrw: '9' })
      .run();
    expect(run(h, false).released).toEqual([]);
    // ...and then a not-signed attempt cleared it.
    h.db.update(orders).set({ fundStartedAt: null, fundTxHash: null, fundAmountAokrw: null }).run();
    expect(run(h, false).released).toEqual([]);
    expect(left()).toEqual(['first']);
  });

  it('dry run writes nothing', () => {
    const { h, put, left } = setup();
    put(hold('h', OLD));
    expect(run(h, true).released).toEqual(['h']);
    expect(left()).toEqual(['h']);
  });
});
