import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../merchants/merchants.service.js';
import { cravingWords, rank, type RankInput } from './score.js';

// Real use: "좋아 추천해" after "매콤한 거 어때용?" got "후보가 없었어용" with 65 stores seeded.
const seed = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../seed/merchants.json'), 'utf8'),
) as {
  merchants: {
    key: string;
    name: string;
    category: string;
    tags: string[];
    // verify-allow: R4 seed prices are whole OKRW integers in the JSON file (tech-spec 7.1)
    menus: { key: string; name: string; price: number; tags: string[] }[];
  }[];
};

const catalog: CatalogEntry[] = seed.merchants.map((m) => ({
  merchant: {
    id: m.key,
    name: m.name,
    category: m.category,
    tags: m.tags,
    verified: true,
    openNow: true,
    etaMin: 20,
  },
  menus: m.menus.map((x) => ({
    id: `${m.key}/${x.key}`,
    name: x.name,
    priceAokrw: okrwToAokrw(BigInt(x.price)),
    tags: x.tags,
    description: '',
    available: true,
  })),
}));

const input = (craving: string): RankInput => ({
  catalog,
  nowMs: Date.parse('2026-12-10T12:28:00+09:00'),
  weather: '맑음',
  craving,
  perOrderLimitAokrw: okrwToAokrw(30_000n),
  myPeriodicLimitAokrw: okrwToAokrw(300_000n),
  chainCapAokrw: okrwToAokrw(500_000n),
  chainUsedAokrw: 0n,
  periodEndMs: Date.parse('2026-12-31T15:00:00.000Z'),
  nagLevel: 'none',
  frozen: false,
  recentOrders: [],
});

describe('craving words match the real seed', () => {
  const words = [
    '매콤',
    '매콤한',
    '매콤한 거',
    '매운 거',
    '매운거',
    '얼큰한',
    '얼큰한 국물',
    '국물',
    '국물 있는 거',
    '따끈한',
    '따끈한 거',
    '뜨끈한 국물',
    '가벼운',
    '가벼운 거',
    '든든한',
    '든든한 거',
    '시원한',
    '달달한',
  ];
  for (const word of words) {
    it(`"${word}" returns candidates that fit`, () => {
      const r = rank(input(word));
      expect(r.items.length, word).toBeGreaterThan(0);
      expect(r.cravingMatched).toBe(true);
      expect(r.empty).toBeNull();
    });
  }

  it('spicy words reach spicy dishes, not just any open store', () => {
    for (const word of ['매콤한 거', '매운 거', '얼큰한']) {
      const tags = rank(input(word)).items.map((i) => i.menu.tags.join());
      expect(
        tags.some((t) => /매콤|매운|국물/.test(t)),
        word,
      ).toBe(true);
    }
  });

  it('filler words alone name nothing, and a spoken form adds its tags', () => {
    expect(cravingWords('거')).toEqual([]);
    expect(cravingWords('음식 메뉴')).toEqual([]);
    expect(cravingWords('매콤한 거')).toEqual(['매콤한', '매콤', '매운']);
  });

  it('a made-up craving matches nothing and invents no match', () => {
    expect(rank(input('쏼라쏼라')).cravingMatched).toBe(false);
  });
});
