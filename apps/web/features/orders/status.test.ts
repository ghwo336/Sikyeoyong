import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '../../lib/api';
import { BUDGET_TONE } from '../budget/tone';
import { orderStep } from './status';

describe('orderStep', () => {
  it('maps orders on their way to the four Done steps', () => {
    expect(orderStep('submitting')).toBe(1);
    expect(orderStep('paid')).toBe(1);
    expect(orderStep('preparing')).toBe(2);
    expect(orderStep('delivering')).toBe(3);
    expect(orderStep('delivered')).toBe(4);
  });

  it('never shows an unpaid or stopped order as accepted', () => {
    const stopped: OrderStatus[] = [
      'quoted',
      'pending_approval',
      'failed',
      'cancelled',
      'refunded',
    ];
    for (const s of stopped) expect(orderStep(s)).toBeNull();
  });
});

describe('BUDGET_TONE', () => {
  it('paints the server nag stage, amber only over 100%', () => {
    expect(BUDGET_TONE).toEqual({
      none: 'normal',
      warn70: 'warn',
      warn90: 'warn',
      over100: 'over',
    });
  });
});
