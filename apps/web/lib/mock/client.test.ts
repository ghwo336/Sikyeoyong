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
      periodUsedAfter: won(219_000n),
      periodCap: won(500_000n),
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
