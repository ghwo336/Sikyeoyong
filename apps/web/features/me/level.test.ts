import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { levelLine } from './level';

describe('levelLine', () => {
  it('reads like Main.dc.html', () => {
    expect(levelLine(1, okrwToAokrw(10_000n))).toBe('레벨 1, 한 번에 10,000원까지');
    expect(levelLine(3, okrwToAokrw(50_000n))).toBe('레벨 3, 한 번에 50,000원까지');
  });
});
