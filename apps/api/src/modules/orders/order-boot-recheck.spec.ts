import { AppError, type Hex, type PaymentProvider } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { orders } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import { OrderBootRecheck } from './order-boot-recheck.service.js';
import { type OrderStatus, OrdersRepository } from './orders.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const ref = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

function setup(findPaid: PaymentProvider['findPaid']) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertUser(h.db, 'u1');
  insertMerchant(h.db, 'm1');
  const repo = new OrdersRepository(h);
  const add = (
    n: number,
    status: OrderStatus,
    marker: { startedAt: number | null; txHash?: string } = { startedAt: null },
  ) =>
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
        submitStartedAt: marker.startedAt,
        submitTxHash: marker.txHash ?? null,
        createdAt: n,
        updatedAt: n,
      })
      .run();
  const find = vi.fn(findPaid);
  // Only findPaid is read here. A pay() on this fake would be a bug: it throws.
  const pay = vi.fn(() => Promise.reject(new Error('the recheck must never pay')));
  const payment = { path: 'B', findPaid: find, pay } as unknown as PaymentProvider;
  const read = (n: number) =>
    h.db
      .select()
      .from(orders)
      .where(eq(orders.id, `o${String(n)}`))
      .get();
  return { svc: new OrderBootRecheck(payment, repo), add, find, pay, read };
}

describe('OrderBootRecheck (payment.md "submitting을 끝내는 규칙")', () => {
  it('moves a marked order the chain has to paid, with the chain tx hash', async () => {
    const t = setup(() => Promise.resolve({ txHash: `0x${'ab'.repeat(32)}`, blockNumber: 7n }));
    t.add(1, 'submitting', { startedAt: 5, txHash: `0x${'cd'.repeat(32)}` });
    expect(await t.svc.run(99)).toEqual({ paid: 1, failed: 0, waiting: 0 });
    expect(t.find).toHaveBeenCalledWith(ref(1));
    expect(t.read(1)).toMatchObject({ status: 'paid', txHash: `0x${'ab'.repeat(32)}` });
    expect(t.pay).not.toHaveBeenCalled();
  });

  it('keeps a marked order submitting when the chain has nothing, hash or not', async () => {
    const t = setup(() => Promise.resolve(null));
    t.add(1, 'submitting', { startedAt: 5, txHash: `0x${'cd'.repeat(32)}` });
    t.add(2, 'submitting', { startedAt: 5 });
    expect(await t.svc.run()).toEqual({ paid: 0, failed: 0, waiting: 2 });
    expect(t.read(1)?.status).toBe('submitting');
    expect(t.read(2)?.status).toBe('submitting');
  });

  it('keeps it submitting when the chain cannot be asked (never failed on a guess)', async () => {
    const t = setup(() => Promise.reject(new AppError('INTERNAL', { reason: 'rpc down' })));
    t.add(1, 'submitting', { startedAt: 5 });
    expect(await t.svc.run()).toEqual({ paid: 0, failed: 0, waiting: 1 });
    expect(t.read(1)?.status).toBe('submitting');
  });

  it('turns an order without a marker into a retryable failure without asking the chain', async () => {
    const t = setup(() => Promise.resolve(null));
    t.add(1, 'submitting');
    expect(await t.svc.run()).toEqual({ paid: 0, failed: 1, waiting: 0 });
    expect(t.read(1)).toMatchObject({ status: 'failed', errorCode: 'INTERNAL' });
    expect(t.find).not.toHaveBeenCalled();
  });

  it('leaves every other status alone', async () => {
    const t = setup(() => Promise.resolve({ txHash: `0x${'ab'.repeat(32)}`, blockNumber: 1n }));
    t.add(1, 'quoted');
    t.add(2, 'paid');
    t.add(3, 'failed', { startedAt: 5 });
    t.add(4, 'pending_approval');
    expect(await t.svc.run()).toEqual({ paid: 0, failed: 0, waiting: 0 });
    expect(t.find).not.toHaveBeenCalled();
    expect([1, 2, 3, 4].map((n) => t.read(n)?.status)).toEqual([
      'quoted',
      'paid',
      'failed',
      'pending_approval',
    ]);
  });

  it('judges only the orders present at the start, not one that starts submitting during the lookup', async () => {
    let release: (v: { txHash: Hex; blockNumber: bigint } | null) => void = () => undefined;
    const t = setup(() => new Promise((r) => (release = r)));
    t.add(1, 'submitting', { startedAt: 5 });
    const pass = t.svc.run();
    t.add(2, 'submitting'); // a request began paying while the chain lookup is pending
    release(null);
    expect(await pass).toEqual({ paid: 0, failed: 0, waiting: 1 });
    expect(t.read(2)?.status).toBe('submitting');
  });

  it('runs once at boot and never throws out of the hook', async () => {
    const t = setup(() => Promise.resolve(null));
    t.add(1, 'submitting');
    t.svc.onApplicationBootstrap();
    expect(await t.svc.pass).toEqual({ paid: 0, failed: 1, waiting: 0 });
  });
});
