import { describe, expect, it } from 'vitest';
import { uuidv7 } from './ids.js';

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('has the v7 shape', () => {
    for (let i = 0; i < 50; i++) expect(uuidv7()).toMatch(V7);
  });

  it('puts the millisecond timestamp in the first 48 bits', () => {
    const id = uuidv7(0x0123456789ab);
    expect(id.startsWith('01234567-89ab-7')).toBe(true);
  });

  it('sorts by time across milliseconds', () => {
    const ids = [1000, 2000, 3000].map((t) => uuidv7(t));
    expect([...ids].sort()).toEqual(ids);
  });

  it('is unique', () => {
    const set = new Set(Array.from({ length: 1000 }, () => uuidv7(5)));
    expect(set.size).toBe(1000);
  });

  it.each([-1, 2 ** 48, 1.5, Number.NaN])('rejects timestamp %s', (t) => {
    expect(() => uuidv7(t)).toThrow(RangeError);
  });
});
