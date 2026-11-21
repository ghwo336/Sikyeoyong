import { zOrderList } from '@sikyeoyong/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { historyLabel, orderHref } from '../../features/orders/active';
import { mockApi, resetMockSession } from './client';

describe('mock order history', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });

  it('lists a stopped order (D-19 failed) so the history shows a 멈춤 row, as the shared schema says', async () => {
    await mockApi.createOrder({
      merchantId: 'maru-gukbap',
      items: [{ menuId: 'pork-gukbap', qty: 1 }],
      clientOrderId: 'h0',
    });
    await mockApi.confirmOrder('order-pork-gukbap');
    const list = await mockApi.listOrders();
    expect(zOrderList.safeParse(list).error?.issues ?? []).toEqual([]);
    const stopped = list.orders.find((o) => o.status === 'failed');
    expect(stopped).toBeDefined();
    if (!stopped) return;
    expect(historyLabel(stopped)).toMatch(/, 멈춤$/);
    // Nothing to open for it (no blank screen), and no payment record.
    expect(orderHref(stopped, 10n ** 30n)).toBeUndefined();
    expect(stopped.txHash).toBeUndefined();
  });

  it('a first owner has no history at all, not even the stopped example', async () => {
    expect((await mockApi.listOrders()).orders).toEqual([]);
  });

  it('keeps the stopped one the oldest, after a paid order', async () => {
    await mockApi.createOrder({
      merchantId: 'maru-gukbap',
      items: [{ menuId: 'pork-gukbap', qty: 1 }],
      clientOrderId: 'h1',
    });
    await mockApi.confirmOrder('order-pork-gukbap');
    const statuses = (await mockApi.listOrders()).orders.map((o) => o.status);
    expect(statuses).toEqual(['preparing', 'failed']);
  });
});
