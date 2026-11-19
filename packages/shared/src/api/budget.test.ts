import { describe, expect, it } from 'vitest';
import type { NagStage } from '../config/policy.js';
import { NAG_STAGES, zBudgetView, type BudgetView } from './budget.js';

// tech-spec 3.2 BudgetView. Amount strings are written by hand (independent of okrwToAokrw).
const VIEW: BudgetView = {
  monthKst: '2026-12',
  personalBudget: '300000000000000000000000',
  personalSpent: '9000000000000000000000',
  nagLevel: 'none',
  chainCap: '500000000000000000000000',
  chainUsed: '9000000000000000000000',
  chainResetAtSec: 1_767_000_000,
  level: 1,
  perOrderLimit: '10000000000000000000000',
  frozen: false,
  budgetOptions: [
    { id: 'small', amount: '200000000000000000000000' },
    { id: 'medium', amount: '300000000000000000000000' },
    { id: 'large', amount: '500000000000000000000000' },
  ],
};

describe('zBudgetView', () => {
  it('accepts the tech-spec shape', () => {
    expect(zBudgetView.parse(VIEW)).toEqual(VIEW);
    expect(zBudgetView.parse({ ...VIEW, chainResetAtSec: null }).chainResetAtSec).toBeNull();
  });

  it.each([
    ['number amount', { personalSpent: 9000 }],
    ['decimal amount', { chainUsed: '1.5' }],
    ['negative amount', { personalBudget: '-1' }],
    ['level 4', { level: 4 }],
    ['unknown nag', { nagLevel: 'warn50' }],
    ['bad month', { monthKst: '2026-13' }],
    ['ms reset time as float', { chainResetAtSec: 1.5 }],
    ['unknown option', { budgetOptions: [{ id: 'huge', amount: '1' }] }],
    ['extra field', { walletAddress: '0xabc' }],
  ])('rejects %s', (_name, patch) => {
    expect(zBudgetView.safeParse({ ...VIEW, ...patch }).success).toBe(false);
  });

  it('keeps nag stages in step with policy NagStage', () => {
    const all: readonly NagStage[] = NAG_STAGES;
    expect(all).toEqual(['none', 'warn70', 'warn90', 'over100']);
  });
});
