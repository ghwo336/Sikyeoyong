import { APP_ERROR_CODES } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { canRetryFailed } from './failed';

describe('canRetryFailed (D-19)', () => {
  it('lets a refused payment that can change be tried again on the same order', () => {
    for (const errorCode of [
      'CHAIN_INSUFFICIENT_FUNDS',
      'CHAIN_PERIODIC_LIMIT',
      'CHAIN_AGENT_PAUSED',
      'SERVER_FROZEN',
      'INTERNAL',
    ] as const) {
      expect(canRetryFailed({ status: 'failed', errorCode })).toBe(true);
    }
  });

  it('needs a new quote for a store, a price or an owner decision', () => {
    for (const errorCode of [
      'CHAIN_MERCHANT_INACTIVE',
      'CHAIN_EAS_REQUIRED',
      'NOT_FOUND',
      'SERVER_PRICE_CHANGED',
      'SERVER_OVER_LEVEL',
      'SERVER_NEW_MERCHANT',
      'SERVER_BUDGET_OVER',
    ] as const) {
      expect(canRetryFailed({ status: 'failed', errorCode })).toBe(false);
    }
  });

  it('never retries without a known reason or on an order that did not fail', () => {
    expect(canRetryFailed({ status: 'failed' })).toBe(false);
    for (const code of APP_ERROR_CODES) {
      expect(canRetryFailed({ status: 'preparing', errorCode: code })).toBe(false);
    }
  });
});
