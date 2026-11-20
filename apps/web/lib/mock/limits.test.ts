import { AppError, okrwToAokrw } from '@sikyeoyong/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, resetMockSession } from './client';

const won = (n: bigint) => okrwToAokrw(n).toString();
const order = (merchantId: string, menuId: string, clientOrderId: string) =>
  mockApi.createOrder({ merchantId, items: [{ menuId, qty: 1 }], clientOrderId });

describe('mock limits (user-flow 12 to 14)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });

  it('a 12,000원 menu waits at level 1 and the Blocked screen can read it; level 3 quotes it', async () => {
    const waiting = await order('hansang-bossam', 'bossam-set', 'c1');
    expect(waiting.order.status).toBe('pending_approval');
    const { order: view } = await mockApi.getOrder(waiting.order.id);
    expect(view).toMatchObject({ status: 'pending_approval', amount: won(12_000n) });
    await mockApi.raiseLevel(3);
    expect(await mockApi.getMe()).toMatchObject({ level: 3, perOrderLimit: won(50_000n) });
    expect((await mockApi.getBudget()).perOrderLimit).toBe(won(50_000n));
    const quoted = await order('hansang-bossam', 'bossam-set', 'c2');
    expect(quoted.order.status).toBe('quoted');
  });

  it('payments use the 30-day window (demo 60,000): two bowls fit, the third is CHAIN_PERIODIC_LIMIT', async () => {
    // 41,000 used; 9,000 + 8,500 = 58,500 fits, then 9,000 more does not.
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainUsed).toBe(won(50_000n));
    expect((await mockApi.getBudget()).chainResetAtSec).not.toBeNull();
    const second = await order('daecheong-bunsik', 'eomuk-gimbap', 'c2');
    await mockApi.confirmOrder(second.order.id);
    expect((await mockApi.getBudget()).chainUsed).toBe(won(58_500n));
    const third = await order('maru-gukbap', 'pork-gukbap', 'c3').catch((e: unknown) => e);
    expect(third).toBeInstanceOf(AppError);
    expect(third).toMatchObject({ code: 'CHAIN_PERIODIC_LIMIT' });
  });

  it('pressing confirm again on a paid order does not spend twice', async () => {
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainUsed).toBe(won(50_000n));
  });
});
