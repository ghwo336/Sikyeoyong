import { describe, expect, it } from 'vitest';
import { riderProgress } from './map';

describe('riderProgress', () => {
  it('starts at the store with 12 minutes or more left, ends home at 0', () => {
    expect(riderProgress(20)).toBe(0);
    expect(riderProgress(12)).toBe(0);
    expect(riderProgress(6)).toBe(0.5);
    expect(riderProgress(0)).toBe(1);
    expect(riderProgress(-3)).toBe(1);
  });
});
