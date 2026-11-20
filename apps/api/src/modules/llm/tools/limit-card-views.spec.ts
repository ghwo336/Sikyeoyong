import { type BudgetView, getPolicy, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { limitCardReply } from './limit-card-views.js';

// Amounts by hand: N won = N * 10^18 aokrw.
const W = (won: string) => `${won}000000000000000000`;
const A = (won: bigint) => okrwToAokrw(won);
const policy = getPolicy('demo'); // 30-day range 10,000..500,000 by 10,000
const view = {
  perOrderLimit: W('20000'),
  myPeriodicLimit: W('30000'),
} as BudgetView;

describe('limitCardReply: the per-order limit never above the 30-day one (D-31)', () => {
  it('drops a per-order card above the 30-day limit', () => {
    expect(
      limitCardReply(policy, view, { field: 'perOrder', amountAokrw: A(35_000n) }, 'c1'),
    ).toMatchObject({ status: 'NO_CARD', reason: 'PER_ORDER_OVER_THIRTY_DAYS' });
  });

  it('drops a 30-day card under the per-order limit', () => {
    expect(
      limitCardReply(policy, view, { field: 'myPeriodic', amountAokrw: A(10_000n) }, 'c1'),
    ).toMatchObject({ status: 'NO_CARD', reason: 'PER_ORDER_OVER_THIRTY_DAYS' });
  });

  it('keeps a card where both meet', () => {
    expect(
      limitCardReply(policy, view, { field: 'perOrder', amountAokrw: A(30_000n) }, 'c1'),
    ).not.toHaveProperty('status', 'NO_CARD');
  });
});
