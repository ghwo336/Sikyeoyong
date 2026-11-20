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
 * NOW is Thursday 2026-12-10 12:28 KST. December has 22 days left counting today.
 * Budget 300,000, spent 80,000: 220,000 left / 22 days = 10,000 a day.
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
  personalBudgetAokrw: w(300_000n),
  personalSpentAokrw: w(80_000n),
  chainCapAokrw: w(500_000n),
  chainUsedAokrw: 0n,
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

  it('puts within-limit matches before over-limit ones', () => {
    // "국물": a1 and b2 match by menu tag (100), a2 matches only by A's tags (50), over limit.
    // a1: 8000 + 10*100 = 9000, b2: 6500 + 1000 = 7500, a2 15,000: affordability 50,
    //   35*50 + 20*50(A tag 국물) + 20*50 + 15*100 + 10*50 = 5750 (over limit, still last).
    expect(picks({ ...BASE, craving: '국물' })).toEqual([
      ['a1', 9000, null],
      ['b2', 7500, null],
      ['a2', 5750, 'OVER_LEVEL_LIMIT'],
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
    expect(picks({ ...BASE, personalSpentAokrw: w(212_000n), nagLevel: 'warn70' })).toEqual([
      ['b2', 7785, null],
      ['a1', 4500, null],
      ['f1', 2875, null],
    ]);
  });

  it('marks menus that would pass the personal budget as needing approval', () => {
    const r = rank({ ...BASE, personalSpentAokrw: w(295_000n), nagLevel: 'warn90' });
    const reasons = Object.fromEntries(r.items.map((x) => [x.menu.id, x.approvalReason]));
    expect(reasons).toEqual({ b2: null, a1: 'OVER_PERSONAL_BUDGET', f1: 'OVER_PERSONAL_BUDGET' });
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
    });
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
