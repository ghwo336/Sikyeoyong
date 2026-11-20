import { describe, expect, it } from 'vitest';
import {
  zMenuView,
  zMerchantCard,
  zMerchantDetail,
  zMerchantList,
  zMerchantListQuery,
} from './merchants.js';

// tech-spec 3.2. 9,000원 = 9000 * 10^18 aokrw, written by hand.
const W9000 = '9000000000000000000000';

const CARD = {
  id: 'm1',
  name: '마루국밥 본점',
  category: '한식',
  tags: ['국물', '따뜻한'],
  verified: true,
  openNow: true,
  etaMin: 3,
};
const MENU = {
  id: 'menu1',
  name: '돼지국밥',
  price: W9000,
  tags: ['국물'],
  description: '',
  available: true,
};

describe('merchant API schemas (tech-spec 3.2)', () => {
  it('accepts the list and detail shapes', () => {
    expect(zMerchantList.parse({ merchants: [CARD] })).toEqual({ merchants: [CARD] });
    expect(zMerchantDetail.parse({ merchant: CARD, menus: [MENU] }).menus[0]?.price).toBe(W9000);
  });

  it.each([
    ['number price', { price: 9000 }],
    ['decimal price', { price: '9000.5' }],
    ['description over 200', { description: 'a'.repeat(201) }],
    ['name over 40', { name: 'a'.repeat(41) }],
    ['extra field', { payoutAddress: '0xabc' }],
  ])('rejects a menu with %s', (_name, patch) => {
    expect(zMenuView.safeParse({ ...MENU, ...patch }).success).toBe(false);
  });

  it.each([
    ['name over 40', { name: 'a'.repeat(41) }],
    ['payout address', { payoutAddress: '0xabc' }],
    ['fractional eta', { etaMin: 2.5 }],
  ])('rejects a merchant card with %s', (_name, patch) => {
    expect(zMerchantCard.safeParse({ ...CARD, ...patch }).success).toBe(false);
  });

  it('takes verified=true only and no other query keys', () => {
    expect(zMerchantListQuery.parse({ category: '한식', verified: 'true' })).toEqual({
      category: '한식',
      verified: 'true',
    });
    expect(zMerchantListQuery.safeParse({ verified: 'false' }).success).toBe(false);
    expect(zMerchantListQuery.safeParse({ userId: 'u2' }).success).toBe(false);
  });
});
