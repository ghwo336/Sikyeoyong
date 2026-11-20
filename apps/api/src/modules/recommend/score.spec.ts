import { type MerchantCard, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import type { CatalogEntry, MenuItem } from '../merchants/merchants.service.js';
import {
  affordabilityFit,
  cravingWords,
  habitFit,
  noveltyFit,
  rank,
  type RankInput,
  type RecentOrder,
} from './score.js';

/*
 * Every expected score below is worked out by hand from tech-spec 3.8:
 * score = 35*affordability + 20*weather + 20*habit + 15*novelty + 10*craving (fits 0..100).
 *
 * NOW is Thursday 2026-12-10 12:28 KST. The 30-day window has 22 days left counting today.
 * The owner's 30-day limit 300,000, chain use 80,000: 220,000 left / 22 days = 10,000 a day.
 */
const NOW = Date.parse('2026-12-10T12:28:00+09:00');
const DAY = 86_400_000;
const w = (won: bigint) => okrwToAokrw(won);

const card = (id: string, category: string, tags: string[], openNow = true): MerchantCard => ({
  id,
  name: id,
  category,
  tags,
  verified: true,
  openNow,
  etaMin: 3,
});
const item = (
  id: string,
  name: string,
  won: bigint,
  tags: string[],
  available = true,
): MenuItem => ({
  id,
  name,
  priceAokrw: w(won),
  tags,
  description: '',
  available,
});

const CATALOG: CatalogEntry[] = [
  {
    merchant: card('A-gukbap', '한식', ['국물', '따뜻한']),
    menus: [item('a1', '돼지국밥', 9_000n, ['국물']), item('a2', '수육', 15_000n, ['고기'])],
  },
  {
    merchant: card('B-bunsik', '분식', ['가성비']),
    menus: [item('b1', '떡볶이', 5_000n, ['매운']), item('b2', '라면', 4_500n, ['국물'])],
  },
  {
    merchant: card('C-chicken', '치킨', ['야식']),
    menus: [item('c1', '후라이드', 20_000n, ['튀김'])],
  },
  {
    merchant: card('D-bossam', '한식', ['고기']),
    menus: [
      item('d1', '보쌈 정식', 12_000n, ['고기']),
      item('d2', '보쌈 대(大)', 45_000n, ['고기', '회식']),
    ],
  },
  { merchant: card('E-salad', '샐러드', [], false), menus: [item('e1', '샐러드', 3_000n, [])] },
  {
    merchant: card('F-jjajang', '중식', ['면']),
    menus: [item('f1', '짜장면', 7_000n, ['면']), item('f2', '짬뽕', 6_000n, ['면'], false)],
  },
];

/** 분식 yesterday, 한식 (A) ten days ago: two orders in 30 days. */
const RECENT: RecentOrder[] = [
  { merchantId: 'B-bunsik', category: '분식', createdAtMs: NOW - DAY },
  { merchantId: 'A-gukbap', category: '한식', createdAtMs: NOW - 10 * DAY },
];

const BASE: RankInput = {
  catalog: CATALOG,
  nowMs: NOW,
  weather: '비',
  perOrderLimitAokrw: w(10_000n),
  myPeriodicLimitAokrw: w(300_000n),
  chainCapAokrw: w(500_000n),
  chainUsedAokrw: w(80_000n),
  // The chain's 30-day window ends 2027-01-01 00:00 KST: 22 days left counting today.
  periodEndMs: Date.parse('2026-12-31T15:00:00.000Z'),
  nagLevel: 'none',
  frozen: false,
  recentOrders: RECENT,
};

const picks = (input: RankInput) =>
  rank(input).items.map((r) => [r.menu.id, r.score, r.approvalReason] as const);

describe('rank (tech-spec 3.8, hand-computed)', () => {
  it('ranks by the weighted score, best menu per merchant, at most three', () => {
    // a1 돼지국밥 9,000: 35*100 + 20*100(국물) + 20*50(한식 1/2) + 15*100 = 8000
    // b2 라면 4,500:     35*100 + 20*100(국물) + 20*50(분식 1/2) + 15*0(어제) = 6500
    // b1 떡볶이 5,000:   35*100 + 0 + 20*50 + 0 = 4500 (B's second menu, dropped)
    // f1 짜장면 7,000:   35*100 + 0 + 20*0 + 15*100 = 5000
    // a2, c1, d1, d2 are over the 10,000 limit with no craving: left out.
    // e1 is closed, f2 unavailable.
    expect(picks(BASE)).toEqual([
      ['a1', 8000, null],
      ['b2', 6500, null],
      ['f1', 5000, null],
    ]);
    const top = rank(BASE).items[0];
    expect(top?.fits).toEqual({
      affordability: 100,
      weather: 100,
      habit: 50,
      novelty: 100,
      craving: 0,
    });
  });

  it('a matching craving ranks only matching menus and lets over-limit ones in with approval', () => {
    // d1 보쌈 정식 12,000: affordability (100*(20,000-12,000))/10,000 = 80
    //   35*80 + 0 + 20*50(한식) + 15*100 + 10*100 = 6300
    // d2 보쌈 대 45,000: affordability 0 (>= 20,000): 0 + 0 + 1000 + 1500 + 1000 = 3500
    const r = rank({ ...BASE, craving: '보쌈 먹고 싶어' });
    expect(r.cravingMatched).toBe(true);
    expect(picks({ ...BASE, craving: '보쌈 먹고 싶어' })).toEqual([
      ['d1', 6300, 'OVER_LEVEL_LIMIT'],
      ['d2', 3500, 'OVER_LEVEL_LIMIT'],
    ]);
  });

  it('puts within-limit matches before an over-limit one even when it scores higher', () => {
    // craving "국밥", no history (habit 0, novelty 100), 10,000 a day, per-order limit 10,000.
    // q1 순대국밥 9,000 (in limit): 35*100 + 0 + 0 + 15*100 + 10*100 = 6000
    // r2 공기밥 1,000 at 국밥집 (merchant name only, craving 50): 3500 + 0 + 0 + 1500 + 500 = 5500
    // p1 특국밥 10,500 (over limit): affordability (100*(20,000-10,500))/10,000 = 95
    //   35*95 + 20*100(국물) + 0 + 1500 + 1000 = 7825, higher than both, still last.
    // r1 수육 15,000 at 국밥집 matches only by merchant name: over limit, so left out.
    const catalog: CatalogEntry[] = [
      { merchant: card('P', '한식', []), menus: [item('p1', '특국밥', 10_500n, ['국물'])] },
      { merchant: card('Q', '한식', []), menus: [item('q1', '순대국밥', 9_000n, [])] },
      {
        merchant: { ...card('R', '한식', []), name: '국밥집' },
        menus: [item('r1', '수육', 15_000n, []), item('r2', '공기밥', 1_000n, [])],
      },
    ];
    expect(picks({ ...BASE, catalog, recentOrders: [], craving: '국밥' })).toEqual([
      ['q1', 6000, null],
      ['r2', 5500, null],
      ['p1', 7825, 'OVER_LEVEL_LIMIT'],
    ]);
  });

  it('lets an over-limit menu in only when the craving names the menu itself', () => {
    // "한식" matches only the category of A and D (craving 50): a1 is in limit and stays,
    // a2, d1, d2 are over limit and matched only by category, so they stay out.
    // a1: 8000 + 10*50 = 8500
    expect(picks({ ...BASE, craving: '한식' })).toEqual([['a1', 8500, null]]);
    // "국물": a1, b2 match by menu tag; a2 수육 matches only by A's tags and is over limit.
    expect(picks({ ...BASE, craving: '국물' })).toEqual([
      ['a1', 9000, null],
      ['b2', 7500, null],
    ]);
  });

  it('per-order limit boundary: exactly the limit is fine, 1 aokrw more needs approval', () => {
    const at = { ...item('k1', '만원국밥', 10_000n, []) };
    const over = { ...item('k2', '만원국밥 곱빼기', 10_000n, []), priceAokrw: w(10_000n) + 1n };
    const catalog: CatalogEntry[] = [{ merchant: card('K', '한식', []), menus: [over, at] }];
    const r = rank({ ...BASE, catalog, recentOrders: [], craving: '만원국밥' });
    expect(r.items.map((x) => [x.menu.id, x.approvalReason])).toEqual([
      ['k1', null],
      ['k2', 'OVER_LEVEL_LIMIT'],
    ]);
  });

  it('a craving that matches nothing changes nothing', () => {
    const r = rank({ ...BASE, craving: '스테이크' });
    expect(r.cravingMatched).toBe(false);
    expect(r.items.map((x) => x.menu.id)).toEqual(['a1', 'b2', 'f1']);
  });

  it('maxPrice filters before ranking', () => {
    // Only b1 5,000 and b2 4,500 fit 5,000; B's best is b2.
    expect(picks({ ...BASE, maxPriceAokrw: w(5_000n) })).toEqual([['b2', 6500, null]]);
  });

  it('warn70 and above weighs affordability 55 instead of 35', () => {
    // spent 212,000: 88,000 left / 22 = 4,000 a day (70.6%, warn70).
    // b2 4,500: (100*(8,000-4,500))/4,000 = 87 -> 55*87 + 2000 + 1000 + 0 = 7785
    // a1 9,000 >= 8,000: 0 + 2000 + 1000 + 1500 = 4500
    // f1 7,000: (100*1,000)/4,000 = 25 -> 1375 + 0 + 0 + 1500 = 2875
    expect(picks({ ...BASE, chainUsedAokrw: w(212_000n), nagLevel: 'warn70' })).toEqual([
      ['b2', 7785, null],
      ['a1', 4500, null],
      ['f1', 2875, null],
    ]);
  });

  it('marks menus that would pass the owner 30-day limit as needing approval', () => {
    const r = rank({ ...BASE, chainUsedAokrw: w(295_000n), nagLevel: 'warn90' });
    const reasons = Object.fromEntries(r.items.map((x) => [x.menu.id, x.approvalReason]));
    expect(reasons).toEqual({ b2: null, a1: 'OVER_PERSONAL_BUDGET', f1: 'OVER_PERSONAL_BUDGET' });
  });

  it('does not mark them when the owner limit equals the chain cap (the chain keeps it, D-31)', () => {
    const r = rank({
      ...BASE,
      myPeriodicLimitAokrw: w(500_000n),
      chainUsedAokrw: w(495_500n),
      nagLevel: 'warn90',
    });
    expect(r.items.map((x) => [x.menu.id, x.approvalReason])).toEqual([['b2', null]]);
  });

  it('leaves out menus the 30-day chain cap would refuse', () => {
    // 495,500 used of 500,000: only b2 4,500 still fits.
    expect(picks({ ...BASE, chainUsedAokrw: w(495_500n) }).map((p) => p[0])).toEqual(['b2']);
  });

  it('recommends nothing while frozen', () => {
    expect(rank({ ...BASE, frozen: true })).toEqual({
      items: [],
      cravingMatched: false,
      frozen: true,
      empty: { reason: 'FROZEN', cheapestAokrw: null, perOrderLimitAokrw: w(10_000n) },
    });
  });

  // Browser QA 2: one open store, a 5,000 per-order limit, "아무거나", nothing back; the dragon
  // blamed the rain. The result says the first filter that left nothing.
  it('says why it is empty: over the per-order limit, with the cheapest menu', () => {
    const r = rank({ ...BASE, perOrderLimitAokrw: w(4_000n) });
    expect(r.items).toEqual([]);
    expect(r.empty).toEqual({
      reason: 'OVER_PER_ORDER_LIMIT',
      cheapestAokrw: w(4_500n),
      perOrderLimitAokrw: w(4_000n),
    });
    expect(rank(BASE).empty).toBeNull();
  });

  it('says why it is empty: every store closed, nothing on sale, asked price, 30-day cap', () => {
    const closed = CATALOG.map((e) => ({ ...e, merchant: { ...e.merchant, openNow: false } }));
    expect(rank({ ...BASE, catalog: closed }).empty?.reason).toBe('ALL_CLOSED');
    const soldOut = CATALOG.map((e) => ({
      ...e,
      menus: e.menus.map((m) => ({ ...m, available: false })),
    }));
    expect(rank({ ...BASE, catalog: soldOut }).empty?.reason).toBe('NO_MENU');
    expect(rank({ ...BASE, maxPriceAokrw: w(1_000n) }).empty).toMatchObject({
      reason: 'OVER_ASKED_PRICE',
      cheapestAokrw: w(4_500n),
    });
    expect(rank({ ...BASE, chainUsedAokrw: w(499_000n) }).empty?.reason).toBe('OVER_30_DAY_CAP');
  });

  it('is the same for the same input, and ties go to the cheaper menu', () => {
    const twins: CatalogEntry[] = [
      { merchant: card('X', '기타', []), menus: [item('x1', '가', 6_000n, [])] },
      { merchant: card('Y', '기타', []), menus: [item('y1', '나', 5_000n, [])] },
    ];
    const input = { ...BASE, catalog: twins, recentOrders: [] };
    expect(picks(input)).toEqual(picks(input));
    expect(picks(input).map((p) => p[0])).toEqual(['y1', 'x1']);
  });

  it('same score and price: the merchant id decides', () => {
    // Listed Y first so only the sort can put X first. Both: 3500 + 0 + 0 + 1500 = 5000.
    const twins: CatalogEntry[] = [
      { merchant: card('Y', '기타', []), menus: [item('y1', '가', 5_000n, [])] },
      { merchant: card('X', '기타', []), menus: [item('x1', '나', 5_000n, [])] },
    ];
    expect(picks({ ...BASE, catalog: twins, recentOrders: [] })).toEqual([
      ['x1', 5000, null],
      ['y1', 5000, null],
    ]);
  });

  it('same merchant, score and price under a craving: the menu id decides', () => {
    // "김밥" matches both menu names: 3500 + 0 + 0 + 1500 + 1000 = 6000 each. z2 listed first.
    const one: CatalogEntry[] = [
      {
        merchant: card('Z', '분식', []),
        menus: [item('z2', '참치김밥', 3_000n, []), item('z1', '야채김밥', 3_000n, [])],
      },
    ];
    expect(picks({ ...BASE, catalog: one, recentOrders: [], craving: '김밥' })).toEqual([
      ['z1', 6000, null],
      ['z2', 6000, null],
    ]);
  });
});

describe('score parts', () => {
  it('affordability is a straight line from the daily share to twice it', () => {
    expect(affordabilityFit(w(10_000n), w(10_000n))).toBe(100);
    expect(affordabilityFit(w(15_000n), w(10_000n))).toBe(50);
    expect(affordabilityFit(w(20_000n), w(10_000n))).toBe(0);
    expect(affordabilityFit(w(1n), 0n)).toBe(0);
  });

  it('habit drops to 0 on the third day in a row', () => {
    const twoDays: RecentOrder[] = [
      { merchantId: 'B', category: '분식', createdAtMs: NOW - DAY },
      { merchantId: 'B', category: '분식', createdAtMs: NOW - 2 * DAY },
      { merchantId: 'A', category: '한식', createdAtMs: NOW - 5 * DAY },
    ];
    expect(habitFit('분식', twoDays, NOW)).toBe(0);
    // 한식 1 of 3 orders: floor(100/3) = 33
    expect(habitFit('한식', twoDays, NOW)).toBe(33);
    expect(habitFit('한식', [], NOW)).toBe(0);
    // older than 30 days does not count
    expect(
      habitFit('한식', [{ merchantId: 'A', category: '한식', createdAtMs: NOW - 31 * DAY }], NOW),
    ).toBe(0);
  });

  it('novelty looks back 72 hours', () => {
    const at = (ms: number): RecentOrder[] => [
      { merchantId: 'A', category: null, createdAtMs: ms },
    ];
    expect(noveltyFit('A', at(NOW - 3 * DAY + 1), NOW)).toBe(0);
    expect(noveltyFit('A', at(NOW - 3 * DAY), NOW)).toBe(100);
    expect(noveltyFit('B', at(NOW - DAY), NOW)).toBe(100);
  });

  it('craving words skip one-letter words', () => {
    expect(cravingWords('보쌈 대(大) 줘!')).toEqual(['보쌈']);
    expect(cravingWords(undefined)).toEqual([]);
  });
});
