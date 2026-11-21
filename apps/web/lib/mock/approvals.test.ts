import { okrwToAokrw, zApprovalDecision, zApprovalList } from '@sikyeoyong/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, resetMockSession } from './client';

const won = (n: bigint) => okrwToAokrw(n).toString();
const gukbap = () =>
  mockApi.createOrder({
    merchantId: 'maru-gukbap',
    items: [{ menuId: 'pork-gukbap', qty: 1 }],
    clientOrderId: 'a1',
  });

// 42,000 used of the 30 days; a 9,000 bowl passes 50,000, so it waits for the owner.
async function waitOnBudget() {
  await mockApi.setLimits({ myPeriodicLimit: won(50_000n) });
  return gukbap();
}

describe('mock owner approvals (GET /approvals, approve, reject)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('an order over my 30 days waits, and its approval is listed as the shared schema says', async () => {
    expect((await waitOnBudget()).order.status).toBe('pending_approval');
    const list = await mockApi.listApprovals();
    expect(zApprovalList.safeParse(list).error?.issues ?? []).toEqual([]);
    expect(list.approvals).toHaveLength(1);
    expect(list.approvals[0]).toMatchObject({
      orderId: 'order-pork-gukbap',
      reason: 'OVER_PERSONAL_BUDGET',
      store: '마루국밥 본점',
      amount: won(9_000n),
    });
  });

  it('approve quotes the order again with its confirm card and pays nothing', async () => {
    await waitOnBudget();
    const [a] = (await mockApi.listApprovals()).approvals;
    if (!a) throw new Error('no approval');
    const spentBefore = (await mockApi.getBudget()).chainUsed;
    const res = await mockApi.approveApproval(a.id);
    expect(zApprovalDecision.safeParse(res).error?.issues ?? []).toEqual([]);
    expect(res.approval.status).toBe('approved');
    expect(res.order).toEqual({ id: 'order-pork-gukbap', status: 'quoted' });
    expect(res.quote?.amount).toBe(won(9_000n));
    expect((await mockApi.listApprovals()).approvals).toEqual([]);
    expect((await mockApi.getBudget()).chainUsed).toBe(spentBefore);
    await expect(mockApi.getOrder('order-pork-gukbap')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // Asked again, the allowed order is quoted at once.
    expect((await gukbap()).order.status).toBe('quoted');
  });

  it('reject stops the order for good: failed in the history, gone from the approvals', async () => {
    await waitOnBudget();
    const [a] = (await mockApi.listApprovals()).approvals;
    if (!a) throw new Error('no approval');
    const res = await mockApi.rejectApproval(a.id);
    expect(res.order.status).toBe('failed');
    expect((await mockApi.listApprovals()).approvals).toEqual([]);
    const { order } = await mockApi.getOrder('order-pork-gukbap');
    expect(order).toMatchObject({ status: 'failed', errorCode: 'SERVER_BUDGET_OVER' });
    expect((await mockApi.listOrders()).orders[0]?.status).toBe('failed');
  });

  it('a per-order wait is listed but cannot be approved here (raise the limit instead)', async () => {
    await mockApi.createOrder({
      merchantId: 'hansang-bossam',
      items: [{ menuId: 'bossam-set', qty: 1 }],
      clientOrderId: 'a2',
    });
    const [a] = (await mockApi.listApprovals()).approvals;
    expect(a?.reason).toBe('OVER_LEVEL_LIMIT');
    await expect(mockApi.approveApproval(a?.id ?? '')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('an approval nobody knows is NOT_FOUND', async () => {
    await expect(mockApi.approveApproval('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(mockApi.rejectApproval('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('an approval is gone after its 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    await waitOnBudget();
    expect((await mockApi.listApprovals()).approvals).toHaveLength(1);
    vi.setSystemTime(new Date('2026-11-20T10:10:00Z'));
    expect((await mockApi.listApprovals()).approvals).toEqual([]);
  });
});
