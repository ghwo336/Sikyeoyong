import { describe, expect, it } from 'vitest';
import {
  zApprovalDecision,
  zApprovalIdParam,
  zApprovalList,
  zApprovalListQuery,
  zApprovalView,
} from './approvals.js';

const W9000 = '9000000000000000000000'; // 9,000원 by hand

describe('approval schemas (tech-spec 3.2)', () => {
  const view = {
    id: 'ap1',
    orderId: 'o1',
    reason: 'NEW_MERCHANT',
    store: '처음국수',
    amount: W9000,
    expiresAt: 1_700_000_600_000,
  };

  it('reads a pending approval with an aokrw amount', () => {
    expect(zApprovalList.parse({ approvals: [view] })).toEqual({ approvals: [view] });
    expect(zApprovalView.safeParse({ ...view, reason: 'BECAUSE' }).success).toBe(false);
    expect(zApprovalView.safeParse({ ...view, amount: 9000 }).success).toBe(false);
    expect(zApprovalView.safeParse({ ...view, extra: 1 }).success).toBe(false);
  });

  it('answers a decision with the order and, when quoted again, its card', () => {
    const d = {
      approval: { id: 'ap1', status: 'approved' },
      order: { id: 'o1', status: 'quoted' },
    };
    expect(zApprovalDecision.parse(d)).toEqual(d);
    expect(
      zApprovalDecision.safeParse({ ...d, approval: { id: 'ap1', status: 'maybe' } }).success,
    ).toBe(false);
    expect(zApprovalIdParam.safeParse('').success).toBe(false);
    expect(zApprovalListQuery.parse({ status: 'pending' })).toEqual({ status: 'pending' });
    expect(zApprovalListQuery.safeParse({ status: 'approved' }).success).toBe(false);
  });
});
