import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { mockApi } from './client';

const won = (n: bigint) => okrwToAokrw(n).toString();

describe('mockApi', () => {
  it('quotes the Confirm design numbers without creating a paid order', async () => {
    const res = await mockApi.createOrder({
      merchantId: 'maru-gukbap',
      items: [{ menuId: 'pork-gukbap', qty: 1 }],
      clientOrderId: 'c1',
    });
    expect(res.order.status).toBe('quoted');
    expect(res.quote).toMatchObject({
      amount: won(9_000n),
      perOrderLimit: won(10_000n),
      // 30 days on the demo profile: 42,000 used + 9,000 of 60,000 (fixtures BUDGET).
      periodUsedAfter: won(51_000n),
      periodCap: won(60_000n),
    });
    await expect(mockApi.getOrder(res.order.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a new store waits for approval and gets no quote', async () => {
    const res = await mockApi.createOrder({
      merchantId: 'hansang-bossam',
      items: [{ menuId: 'bossam-set', qty: 1 }],
      clientOrderId: 'c2',
    });
    expect(res).toEqual({ order: { id: 'order-bossam-set', status: 'pending_approval' } });
  });

  it('a chat message only quotes; the order exists after confirm', async () => {
    const events = await mockApi.sendChatMessage({ text: '돼지국밥으로', clientMessageId: 'm1' });
    expect(events.map((e) => e.type)).toEqual(['order_confirm', 'done']);
    const { order } = await mockApi.confirmOrder('order-pork-gukbap');
    expect(order.status).toBe('preparing');
    await expect(mockApi.getOrder('order-pork-gukbap')).resolves.toEqual({ order });
  });
});

describe('mock wallet money', () => {
  it('돌려받기 moves the whole pocket to the owner, exactly in bigint', async () => {
    const { resetMockSession } = await import('./client');
    resetMockSession('hatched');
    await mockApi.refundPocket();
    const after = await mockApi.getWallet();
    // 81,000 + 20,000 = 101,000원; the pocket is empty.
    expect(after.owner).toBe(won(101_000n));
    expect(after.pocket).toBe('0');
    await mockApi.refundPocket();
    expect((await mockApi.getWallet()).owner).toBe(won(101_000n)); // nothing left to move
  });
});

describe('mock look and order list (D-32)', () => {
  it('PATCH changes only the look of my own dragon; another id is not found', async () => {
    const { resetMockSession } = await import('./client');
    resetMockSession('hatched');
    const before = await mockApi.getMe();
    expect(await mockApi.patchAgent(before.agentId, { dragonSpecies: 'star' })).toEqual({
      dragonSpecies: 'star',
    });
    const after = await mockApi.getMe();
    expect(after).toEqual({ ...before, dragonSpecies: 'star' });
    await expect(
      mockApi.patchAgent('someone-else', { dragonSpecies: 'water' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lists only confirmed orders, newest first; a quote alone is not there', async () => {
    const { resetMockSession } = await import('./client');
    resetMockSession('hatched');
    expect((await mockApi.listOrders()).orders).toEqual([]);
    const order = (menuId: string, merchantId: string) =>
      mockApi.createOrder({ merchantId, items: [{ menuId, qty: 1 }], clientOrderId: menuId });
    const first = await order('pork-gukbap', 'maru-gukbap');
    expect((await mockApi.listOrders()).orders).toEqual([]);
    await mockApi.confirmOrder(first.order.id);
    await new Promise((r) => setTimeout(r, 5));
    const second = await order('eomuk-gimbap', 'daecheong-bunsik');
    await mockApi.confirmOrder(second.order.id);
    const { orders } = await mockApi.listOrders();
    // The older stopped example (history.test.ts) always comes last.
    expect(orders.map((o) => o.id)).toEqual([
      second.order.id,
      first.order.id,
      'order-stopped-example',
    ]);
    expect(orders[0]?.status).toBe('preparing');
    // The 멈춤 row opens its status screen, so the mock can answer for it (QA 5).
    const stopped = await mockApi.getOrder('order-stopped-example');
    expect(stopped.order).toMatchObject({ status: 'failed', errorCode: 'CHAIN_PERIODIC_LIMIT' });
  });
});
