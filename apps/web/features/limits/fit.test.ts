import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { limitToFit } from './fit';

const won = okrwToAokrw;

describe('limitToFit (D-31: 5,000 steps up to 50,000)', () => {
  it('is the smallest step that covers the order', () => {
    expect(limitToFit(won(9_000n))).toBe(won(10_000n));
    expect(limitToFit(won(45_000n))).toBe(won(45_000n));
    expect(limitToFit(won(45_000n) + 1n)).toBe(won(50_000n));
  });

  it('is undefined above the top', () => {
    expect(limitToFit(won(50_000n) + 1n)).toBeUndefined();
  });
});
