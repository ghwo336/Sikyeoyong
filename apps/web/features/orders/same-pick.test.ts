import { describe, expect, it } from 'vitest';
import type { OrderQuote, OrderView, RecommendationCard } from '../../lib/api';
import { openQuoteFor, waitingFor } from './same-pick';

const rec = {
  id: 'r1',
  merchantId: 'm1',
  menuId: 'mn1',
  store: '대청분식',
  etaMin: 3,
  menu: '라면',
  price: '4500',
  needsApproval: true,
} as RecommendationCard;
const items = [{ name: '라면', quantity: 1, price: '4500' }];
const order = (id: string, status: string, over: Partial<OrderView> = {}) =>
  ({ id, status, store: '대청분식', items, amount: '4500', ...over }) as unknown as OrderView;
const quote = { orderId: 'o1', store: '대청분식', items, amount: '4500' } as unknown as OrderQuote;

describe('same pick', () => {
  it('finds the order of this pick that waits for the owner', () => {
    expect(waitingFor(rec, [order('o1', 'pending_approval')])?.id).toBe('o1');
  });
  it('ignores other menus, other stores and orders that are not waiting', () => {
    expect(waitingFor(rec, [order('o1', 'preparing')])).toBeUndefined();
    expect(waitingFor(rec, [order('o1', 'pending_approval', { store: '다른집' })])).toBeUndefined();
    expect(
      waitingFor(rec, [
        order('o1', 'pending_approval', { items: [{ name: '김밥', quantity: 1, price: '4500' }] }),
      ]),
    ).toBeUndefined();
    expect(waitingFor(rec, undefined)).toBeUndefined();
  });
  it('reuses the open quote until its order shows in the list (then it was confirmed)', () => {
    expect(openQuoteFor(rec, quote, [])).toBe(quote);
    expect(openQuoteFor(rec, quote, [order('o1', 'preparing')])).toBeUndefined();
    expect(openQuoteFor(rec, undefined, [])).toBeUndefined();
    expect(openQuoteFor({ ...rec, menu: '김밥' }, quote, [])).toBeUndefined();
  });
});
