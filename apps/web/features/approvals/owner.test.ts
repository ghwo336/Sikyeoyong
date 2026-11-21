import { describe, expect, it } from 'vitest';
import type { ApprovalView } from '../../lib/api';
import { ownerApprovals } from './owner';

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
