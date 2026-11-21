import { describe, expect, it } from 'vitest';
import type { ApprovalView } from '../../lib/api';
import { cardsToShow, type OwnerApproval, ownerApprovals } from './owner';

const view = (id: string, reason: ApprovalView['reason']): ApprovalView => ({
  id,
  orderId: `o-${id}`,
  reason,
  store: '한상보쌈',
  amount: '12000000000000000000000',
  expiresAt: 1,
});

describe('ownerApprovals', () => {
  it('keeps a new store and the 30-day limit, drops the per-order wait (the limit screens own it)', () => {
    const all = [
      view('a', 'OVER_LEVEL_LIMIT'),
      view('b', 'NEW_MERCHANT'),
      view('c', 'OVER_PERSONAL_BUDGET'),
    ];
    expect(ownerApprovals(all).map((a) => a.id)).toEqual(['b', 'c']);
  });

  it('is empty for no approvals', () => {
    expect(ownerApprovals([])).toEqual([]);
  });
});

describe('cardsToShow', () => {
  const a = (id: string) => view(id, 'NEW_MERCHANT') as OwnerApproval;

  it('draws a card only for an approval whose order is still pending_approval', () => {
    const orders = [
      { id: 'o-a', status: 'pending_approval' },
      { id: 'o-b', status: 'quoted' },
      { id: 'o-c', status: 'failed' },
    ];
    expect(cardsToShow([a('a'), a('b'), a('c'), a('d')], orders).map((x) => x.id)).toEqual(['a']);
  });

  it('draws nothing before the orders are known', () => {
    expect(cardsToShow([a('a')], undefined)).toEqual([]);
  });
});
