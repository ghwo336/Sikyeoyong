import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOpenAt } from './open-hours.js';

// The mock market in seed/merchants.json (2026-11-21): QA found zero recommendations at night
// because only two stores were open and both cost more than the first per-order limit.
const seed = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../seed/merchants.json'), 'utf8'),
) as {
  merchants: {
    key: string;
    verified: boolean;
    openHours: Record<string, string>;
    // verify-allow: R4 seed prices are whole OKRW integers in the JSON file (tech-spec 7.1)
    menus: { price: number }[];
  }[];
};
const verified = seed.merchants.filter((m) => m.verified);

describe('seed market coverage', () => {
  it('every hour of every day has at least three open stores with a dish within 10,000원', () => {
    // 2026-11-16 is a Monday; walk a whole week hour by hour in KST.
    const mondayKstMidnight = Date.UTC(2026, 10, 16) - 9 * 3_600_000;
    for (let h = 0; h < 7 * 24; h += 1) {
      const at = mondayKstMidnight + h * 3_600_000 + 30 * 60_000;
      const cheapOpen = verified.filter(
        (m) => isOpenAt(m.openHours, at) && m.menus.some((x) => x.price <= 10_000),
      );
      expect(cheapOpen.length, `hour ${String(h)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps expensive dishes too, for the limit scenes and group orders', () => {
    const prices = verified.flatMap((m) => m.menus.map((x) => x.price));
    expect(prices.filter((p) => p > 30_000).length).toBeGreaterThanOrEqual(10);
    expect(Math.max(...prices)).toBeGreaterThanOrEqual(100_000);
  });
});
