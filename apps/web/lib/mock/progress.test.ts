import { zOrderView } from '@sikyeoyong/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockSession } from './client';

const T0 = Date.parse('2026-12-10T03:00:00.000Z');
const ID = 'order-pork-gukbap';

/** Advances the fake clock to `ms` after T0 and reads the order (its 250 ms latency included). */
async function at(ms: number) {
  vi.setSystemTime(T0 + ms);
  const p = mockApi.getOrder(ID);
  await vi.advanceTimersByTimeAsync(300);
  return zOrderView.parse((await p).order);
}

describe('mock order clock: 20 s cooking, 20 s riding, then arrived', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    resetMockSession('hatched');
    const q = mockApi.createOrder({
      merchantId: 'maru-gukbap',
      items: [{ menuId: 'pork-gukbap', qty: 1 }],
      clientOrderId: 'c1',
    });
    await vi.advanceTimersByTimeAsync(300);
    await q;
    vi.setSystemTime(T0);
    const c = mockApi.confirmOrder(ID);
    await vi.advanceTimersByTimeAsync(300);
    await c;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves on at the edges and stops counting at zero; every answer fits zOrderView', async () => {
    expect((await at(0)).status).toBe('preparing');
    expect((await at(19_999)).status).toBe('preparing');
    expect((await at(20_000)).status).toBe('delivering');
    expect((await at(39_999)).status).toBe('delivering');
    const arrived = await at(40_000);
    expect(arrived.status).toBe('delivered');
    expect(arrived.remainingMin).toBe(0);
    expect((await at(600_000)).remainingMin).toBe(0);
  });

  it('pressing confirm again does not restart the clock', async () => {
    vi.setSystemTime(T0 + 30_000);
    const again = mockApi.confirmOrder(ID);
    await vi.advanceTimersByTimeAsync(300);
    expect((await again).order.status).toBe('delivering');
    expect((await at(40_000)).status).toBe('delivered');
  });
});
