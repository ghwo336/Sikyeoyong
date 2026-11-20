import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { levelFor } from './levels';

const won = (n: bigint) => okrwToAokrw(n);

describe('levelFor (D-07: 10,000 / 30,000 / 50,000)', () => {
  it('picks the lowest level that covers the amount, edges included', () => {
    expect(levelFor(won(10_000n))).toEqual({ level: 1, limit: won(10_000n) });
    expect(levelFor(won(10_000n) + 1n)).toEqual({ level: 2, limit: won(30_000n) });
    expect(levelFor(won(45_000n))).toEqual({ level: 3, limit: won(50_000n) });
    expect(levelFor(won(50_000n) + 1n)).toBeUndefined();
  });
});
