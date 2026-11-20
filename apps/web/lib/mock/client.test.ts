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
      // 30 days on the demo profile: 41,000 used + 9,000 of 60,000 (fixtures BUDGET).
      periodUsedAfter: won(50_000n),
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
