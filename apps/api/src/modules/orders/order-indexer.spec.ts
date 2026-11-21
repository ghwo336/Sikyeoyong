import type { Hex } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { orderEvents, orders } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import type { OrderEventsReader, PlacedLog } from '../chain/chain.service.js';
import type { MerchantsService } from '../merchants/merchants.service.js';
import { INDEXER_CHUNK_BLOCKS, OrderIndexer } from './order-indexer.service.js';
import { type OrderStatus, OrdersRepository } from './orders.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const ref = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, 'f')}`;
const log = (n: number, block = 10n, logIndex = 0): PlacedLog => ({
  orderRef: ref(n),
  txHash: hash(n),
  logIndex,
  blockNumber: block,
  merchantId: 77n,
  amount: 1n,
});

function setup(logs: PlacedLog[], opts: { latest?: bigint; start?: bigint } = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertUser(h.db, 'u1');
  insertMerchant(h.db, 'm1');
  const add = (n: number, status: OrderStatus) =>
    h.db
      .insert(orders)
      .values({
        id: `o${String(n)}`,
        orderRef: ref(n),
        userId: 'u1',
        agentId: 'a-u1',
        merchantId: 'm1',
        amountAokrw: '1',
        itemsJson: '[]',
        status,
        createdAt: n,
        updatedAt: n,
      })
      .run();
  const ranges: [bigint, bigint][] = [];
  const reader: OrderEventsReader = {
    chainId: 1234,
    contract: `0x${'11'.repeat(20)}`,
    startBlock: opts.start ?? 5n,
    latestBlock: () => Promise.resolve(opts.latest ?? 20n),
    orderPlaced: (from, to) => {
      ranges.push([from, to]);
      return Promise.resolve(logs.filter((l) => l.blockNumber >= from && l.blockNumber <= to));
    },
  };
  const merchants = {
    orderInfoOf: () => ({ name: 'm', etaMin: 1, onchainId: 77n }),
  } as unknown as MerchantsService;
  const indexer = new OrderIndexer(reader, new OrdersRepository(h), merchants);
  const read = (n: number) =>
    h.db
      .select()
      .from(orders)
      .where(eq(orders.id, `o${String(n)}`))
      .get();
  return { h, add, indexer, read, ranges, reader, merchants };
}

describe('OrderIndexer (payment.md "submitting을 끝내는 규칙")', () => {
  it('confirms a submitting order as paid with the chain tx hash', async () => {
    const t = setup([log(1)]);
    t.add(1, 'submitting');
    expect(await t.indexer.tick(99)).toBe(1);
    expect(t.read(1)).toMatchObject({ status: 'paid', txHash: hash(1), errorCode: null });
  });

  it('confirms a retryable failed order whose transaction landed after all', async () => {
    const t = setup([log(1)]);
    t.add(1, 'failed');
    await t.indexer.tick();
    expect(t.read(1)?.status).toBe('paid');
  });

  it('is idempotent: the same log twice changes nothing and writes one event', async () => {
    const t = setup([log(1), log(1)]);
    t.add(1, 'submitting');
    expect(await t.indexer.tick()).toBe(1);
    const again = new OrderIndexer(t.reader, new OrdersRepository(t.h), t.merchants);
    expect(await again.tick()).toBe(0);
    expect(t.read(1)?.status).toBe('paid');
    expect(t.h.db.select().from(orderEvents).all()).toHaveLength(1);
  });

  it('re-reading a recorded event neither throws nor stalls the chunk: later logs still confirm', async () => {
    const t = setup([log(1), log(2)], { start: 5n, latest: 20n });
    t.add(1, 'submitting');
    t.add(2, 'submitting');
    // After a restart the same log is read again: its event row already exists.
    new OrdersRepository(t.h).recordChainEvent('o1', 'OrderPlaced', hash(1), 0, {}, 1);
    expect(await t.indexer.tick()).toBe(2);
    expect(t.read(1)?.status).toBe('paid');
    expect(t.read(2)?.status).toBe('paid');
    t.ranges.length = 0;
    await t.indexer.tick();
    expect(t.ranges).toEqual([]); // the cursor moved past the chunk
    expect(t.h.db.select().from(orderEvents).all()).toHaveLength(2);
  });

  it('does not mark paid a log whose amount or merchant differs from the order', async () => {
    const t = setup([{ ...log(1), amount: 2n }, { ...log(2), merchantId: 78n }, log(3)]);
    t.add(1, 'submitting');
    t.add(2, 'submitting');
    t.add(3, 'submitting');
    expect(await t.indexer.tick()).toBe(1);
    expect([1, 2, 3].map((n) => t.read(n)?.status)).toEqual(['submitting', 'submitting', 'paid']);
  });

  it('does not mark paid when the merchant has no on-chain id to compare', async () => {
    const t = setup([log(1)]);
    t.add(1, 'submitting');
    const none = {
      orderInfoOf: () => ({ name: 'm', etaMin: 1, onchainId: null }),
    } as unknown as MerchantsService;
    const indexer = new OrderIndexer(t.reader, new OrdersRepository(t.h), none);
    expect(await indexer.tick()).toBe(0);
    expect(t.read(1)?.status).toBe('submitting');
  });

  it('logs and ignores an orderRef it does not know, and keeps going', async () => {
    const t = setup([log(9), log(1)]);
    t.add(1, 'submitting');
    expect(await t.indexer.tick()).toBe(1);
    expect(t.read(1)?.status).toBe('paid');
    expect(t.h.db.select().from(orderEvents).all()).toHaveLength(1);
  });

  it('does not trust a log for an order that never began paying, nor touch a final state', async () => {
    const t = setup([log(1), log(2), log(3)]);
    t.add(1, 'quoted');
    t.add(2, 'pending_approval');
    t.add(3, 'cancelled');
    expect(await t.indexer.tick()).toBe(0);
    expect([1, 2, 3].map((n) => t.read(n)?.status)).toEqual([
      'quoted',
      'pending_approval',
      'cancelled',
    ]);
  });

  it('reads from the deployment block in chunks and resumes after the last block', async () => {
    const latest = 5n + INDEXER_CHUNK_BLOCKS * 2n + 3n;
    const t = setup([log(1, 5n), log(2, latest)], { latest, start: 5n });
    t.add(1, 'submitting');
    t.add(2, 'submitting');
    expect(await t.indexer.tick()).toBe(2);
    expect(t.ranges[0]?.[0]).toBe(5n);
    expect(t.ranges).toHaveLength(3);
    expect(t.ranges.at(-1)?.[1]).toBe(latest);
    t.ranges.length = 0;
    await t.indexer.tick();
    expect(t.ranges).toEqual([]); // nothing new: the cursor is past latest
  });

  it('stores the last applied block, and a restarted indexer resumes after it', async () => {
    const t = setup([log(1, 6n), log(2, 18n)], { latest: 10n, start: 5n });
    t.add(1, 'submitting');
    t.add(2, 'submitting');
    expect(await t.indexer.tick()).toBe(1);
    expect(new OrdersRepository(t.h).indexerCursor(1234, `0x${'11'.repeat(20)}`)).toBe(10n);
    // New process, the chain moved on: the first read starts at block 11, not at the deployment.
    const later = setup([log(2, 18n)], { latest: 20n, start: 5n });
    later.add(2, 'submitting');
    new OrdersRepository(later.h).saveIndexerCursor(1234, `0x${'11'.repeat(20)}`, 10n, 1);
    expect(await later.indexer.tick()).toBe(1);
    expect(later.ranges[0]).toEqual([11n, 20n]);
    expect(later.read(2)?.status).toBe('paid');
  });

  it('falls back to the deployment block with no stored cursor or one behind it', async () => {
    const t = setup([], { latest: 12n, start: 8n });
    await t.indexer.tick();
    expect(t.ranges[0]?.[0]).toBe(8n);
    const stale = setup([], { latest: 12n, start: 8n });
    new OrdersRepository(stale.h).saveIndexerCursor(1234, `0x${'11'.repeat(20)}`, 3n, 1);
    await stale.indexer.tick();
    expect(stale.ranges[0]?.[0]).toBe(8n);
  });

  it('does not store the block of a chunk that failed, and never moves a cursor back', async () => {
    const t = setup([log(1)], { latest: 10n });
    t.add(1, 'submitting');
    vi.spyOn(t.reader, 'orderPlaced').mockRejectedValueOnce(new Error('rpc down'));
    await t.indexer.tick();
    const repo = new OrdersRepository(t.h);
    expect(repo.indexerCursor(1234, `0x${'11'.repeat(20)}`)).toBeNull();
    repo.saveIndexerCursor(1234, `0x${'11'.repeat(20)}`, 9n, 1);
    repo.saveIndexerCursor(1234, `0x${'11'.repeat(20)}`, 4n, 2);
    expect(repo.indexerCursor(1234, `0x${'11'.repeat(20)}`)).toBe(9n);
  });

  it('keeps the cursor when a read fails, so the chunk is read again', async () => {
    const t = setup([log(1)]);
    t.add(1, 'submitting');
    const spy = vi.spyOn(t.reader, 'orderPlaced').mockRejectedValueOnce(new Error('rpc down'));
    expect(await t.indexer.tick()).toBe(0);
    expect(t.read(1)?.status).toBe('submitting');
    spy.mockRestore();
    expect(await t.indexer.tick()).toBe(1);
    expect(t.read(1)?.status).toBe('paid');
  });

  it('does nothing without a reader (the mock path)', async () => {
    const t = setup([]);
    const none = new OrderIndexer(null, new OrdersRepository(t.h), t.merchants);
    none.onApplicationBootstrap();
    expect(await none.tick()).toBe(0);
    none.onModuleDestroy();
  });
});
