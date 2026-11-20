import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { limitLine } from './limit-line';

describe('limitLine', () => {
  it('reads like Main.dc.html, without a level (D-31)', () => {
    expect(limitLine(okrwToAokrw(10_000n))).toBe('한 번에 10,000원까지');
    expect(limitLine(okrwToAokrw(45_000n))).toBe('한 번에 45,000원까지');
  });
});
