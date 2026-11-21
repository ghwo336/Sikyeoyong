import { describe, expect, it } from 'vitest';
import { zLeakCompareView, type LeakCompareView } from './demo.js';

// Amount strings are written by hand (independent of okrwToAokrw).
const VIEW: LeakCompareView = {
  perOrderLimit: '10000000000000000000000',
  periodicCap: '60000000000000000000000',
  periodicPeriodSec: 3_600,
  floatAtRisk: '20100000000000000000000',
  pocket: '0',
};

describe('zLeakCompareView (demo scene 5)', () => {
  it('accepts the shape the API sends', () => {
    expect(zLeakCompareView.parse(VIEW)).toEqual(VIEW);
  });

  it.each([
    ['an extra key', { ...VIEW, privateKey: '0x1' }],
    ['a zero period', { ...VIEW, periodicPeriodSec: 0 }],
    ['a negative period', { ...VIEW, periodicPeriodSec: -3_600 }],
    ['a fractional period', { ...VIEW, periodicPeriodSec: 1.5 }],
    ['a decimal amount', { ...VIEW, floatAtRisk: '1.5' }],
    ['a negative amount', { ...VIEW, pocket: '-1' }],
    ['an empty amount', { ...VIEW, perOrderLimit: '' }],
    ['a number amount', { ...VIEW, periodicCap: 60000 }],
  ])('rejects %s', (_name, value) => {
    expect(zLeakCompareView.safeParse(value).success).toBe(false);
  });
});
