import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, resetMockSession, setMockChainUsedForTests } from './client';

const won = (n: bigint) => okrwToAokrw(n).toString();
const order = (merchantId: string, menuId: string, clientOrderId: string) =>
  mockApi.createOrder({ merchantId, items: [{ menuId, qty: 1 }], clientOrderId });

describe('mock limits (user-flow 12 to 14)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });

  it('a 12,000원 menu waits at 10,000 and the Blocked screen can read it; raised to 50,000 it is quoted', async () => {
    const waiting = await order('hansang-bossam', 'bossam-set', 'c1');
    expect(waiting.order.status).toBe('pending_approval');
    const { order: view } = await mockApi.getOrder(waiting.order.id);
    expect(view).toMatchObject({ status: 'pending_approval', amount: won(12_000n) });
    await mockApi.setLimits({ perOrderLimit: won(50_000n) });
    expect(await mockApi.getMe()).toMatchObject({ perOrderLimit: won(50_000n) });
    expect((await mockApi.getBudget()).perOrderLimit).toBe(won(50_000n));
    const quoted = await order('hansang-bossam', 'bossam-set', 'c2');
    expect(quoted.order.status).toBe('quoted');
    expect(quoted.quote?.perOrderLimit).toBe(won(50_000n)); // the raised limit, not the first
  });

  it('payments use the 30-day window (demo 60,000): two bowls fit, the third is CHAIN_PERIODIC_LIMIT', async () => {
    // 42,000 used; 9,000 + 8,500 = 59,500 fits, then 9,000 more does not.
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainUsed).toBe(won(51_000n));
    expect((await mockApi.getBudget()).chainResetAtSec).not.toBeNull();
    const second = await order('daecheong-bunsik', 'eomuk-gimbap', 'c2');
    await mockApi.confirmOrder(second.order.id);
    expect((await mockApi.getBudget()).chainUsed).toBe(won(59_500n));
    const third = await order('maru-gukbap', 'pork-gukbap', 'c3').catch((e: unknown) => e);
    expect(third).toBeInstanceOf(AppError);
    expect(third).toMatchObject({ code: 'CHAIN_PERIODIC_LIMIT' });
  });

  it('pressing confirm again on a paid order does not spend twice', async () => {
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainUsed).toBe(won(51_000n));
  });

  it('a payment that lands exactly on the 60,000 cap goes through; one aokrw over is refused', async () => {
    setMockChainUsedForTests(okrwToAokrw(51_000n));
    expect((await order('maru-gukbap', 'pork-gukbap', 'c1')).order.status).toBe('quoted');
    setMockChainUsedForTests(okrwToAokrw(51_000n) + 1n);
    await expect(order('maru-gukbap', 'pork-gukbap', 'c2')).rejects.toMatchObject({
      code: 'CHAIN_PERIODIC_LIMIT',
    });
  });

  it('a payment adds to the 30-day spend and moves the nag stage (42,000 + 9,000 of my 60,000)', async () => {
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    const b = await mockApi.getBudget();
    expect(b.chainUsed).toBe(won(51_000n));
    expect(b.nagLevel).toBe('warn70'); // 85%
  });
});
