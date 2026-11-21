import { okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockSession, setMockChainUsedForTests } from './client';

const order = (merchantId: string, menuId: string, clientOrderId: string) =>
  mockApi.createOrder({ merchantId, items: [{ menuId, qty: 1 }], clientOrderId });

const sec = (iso: string): number => Date.parse(iso) / 1000;

// The demo profile's 30-day window is aligned to the hour on unix time (the chain's too): it
// refills at the next hour boundary, not an hour after the first payment.
describe('mock 30-day window edge (demo profile, fixed clock)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a first payment mid-hour opens a window that ends at the next hour, not now + 3600', async () => {
    vi.setSystemTime(new Date('2026-11-20T10:20:30Z'));
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainResetAtSec).toBe(sec('2026-11-20T11:00:00Z'));
  });

  it('one second before the boundary the window ends in one second', async () => {
    vi.setSystemTime(new Date('2026-11-20T10:59:59Z'));
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainResetAtSec).toBe(sec('2026-11-20T11:00:00Z'));
  });

  it('exactly on the boundary a new window starts and ends an hour later', async () => {
    vi.setSystemTime(new Date('2026-11-20T11:00:00.000Z'));
    await order('maru-gukbap', 'pork-gukbap', 'c1');
    await mockApi.confirmOrder('order-pork-gukbap');
    expect((await mockApi.getBudget()).chainResetAtSec).toBe(sec('2026-11-20T12:00:00Z'));
  });

  it('a refusal over the cap names the same boundary (Cap screen: when it refills)', async () => {
    vi.setSystemTime(new Date('2026-11-20T10:20:30Z'));
    setMockChainUsedForTests(okrwToAokrw(51_000n) + 1n);
    await expect(order('maru-gukbap', 'pork-gukbap', 'c2')).rejects.toMatchObject({
      code: 'CHAIN_PERIODIC_LIMIT',
    });
    // 11:00 UTC is 20:00 in Seoul.
    expect((await mockApi.getBudget()).chainResetAtSec).toBe(sec('2026-11-20T11:00:00Z'));
  });
});
