import { describe, expect, it } from 'vitest';
import { NAG_STAGES } from '../config/policy.js';
import { zBudgetView, type BudgetView } from './budget.js';

// tech-spec 3.2 BudgetView. Amount strings are written by hand (independent of okrwToAokrw).
const RANGE = {
  min: '5000000000000000000000',
  max: '50000000000000000000000',
  step: '5000000000000000000000',
};
const VIEW: BudgetView = {
  myPeriodicLimit: '300000000000000000000000',
  nagLevel: 'none',
  chainCap: '500000000000000000000000',
  chainUsed: '9000000000000000000000',
  chainResetAtSec: 1_767_000_000,
  perOrderLimit: '10000000000000000000000',
  frozen: false,
  limitRanges: {
    perOrder: RANGE,
    myPeriodic: {
      min: '50000000000000000000000',
      max: '500000000000000000000000',
      step: '50000000000000000000000',
    },
  },
};

describe('zBudgetView', () => {
  it('accepts the tech-spec shape', () => {
    expect(zBudgetView.parse(VIEW)).toEqual(VIEW);
    expect(zBudgetView.parse({ ...VIEW, chainResetAtSec: null }).chainResetAtSec).toBeNull();
  });

  it.each([
    ['number amount', { chainUsed: 9000 }],
    ['decimal amount', { chainUsed: '1.5' }],
    ['negative amount', { myPeriodicLimit: '-1' }],
    ['a level (gone, D-31)', { level: 1 }],
    ['the old monthly budget (gone, D-31)', { personalBudget: '1' }],
    ['unknown nag', { nagLevel: 'warn50' }],
    ['ms reset time as float', { chainResetAtSec: 1.5 }],
    ['extra field', { walletAddress: '0xabc' }],
    [
      'a range without step',
      { limitRanges: { perOrder: { min: '1', max: '2' }, myPeriodic: RANGE } },
    ],
    [
      'extra field in a range',
      { limitRanges: { perOrder: { ...RANGE, extra: 1 }, myPeriodic: RANGE } },
    ],
    ['negative reset time', { chainResetAtSec: -1 }],
  ])('rejects %s', (_name, patch) => {
    expect(zBudgetView.safeParse({ ...VIEW, ...patch }).success).toBe(false);
  });

  it.each(NAG_STAGES)('accepts every policy nag stage (%s)', (nagLevel) => {
    expect(zBudgetView.parse({ ...VIEW, nagLevel }).nagLevel).toBe(nagLevel);
  });
});
