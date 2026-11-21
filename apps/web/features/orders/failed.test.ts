import { APP_ERROR_CODES } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { canRetryFailed, stoppedLine } from './failed';

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

describe('stoppedLine (QA 6 L2)', () => {
  const base = { status: 'failed' as const, dragonLine: '이번 달 예산을 넘는데 그래도 시킬까용?' };
  it('turns a question with no button to answer it into a plain line to the chat', () => {
    expect(stoppedLine({ ...base, errorCode: 'SERVER_BUDGET_OVER' })).toBe(
      '이번 달 예산을 넘어서 멈췄어용. 다시 시키려면 대화에서 골라 주세용.',
    );
    expect(stoppedLine({ ...base, dragonLine: '어쩌지용?', errorCode: 'NOT_FOUND' })).toBe(
      '이 주문은 멈췄어용. 다시 시키려면 대화에서 골라 주세용.',
    );
  });
  it('keeps the server words when they are not a question or the order can retry', () => {
    const plain = {
      ...base,
      dragonLine: '가게 가격이 바뀌었어용.',
      errorCode: 'SERVER_PRICE_CHANGED' as const,
    };
    expect(stoppedLine(plain)).toBe('가게 가격이 바뀌었어용.');
    expect(stoppedLine({ ...base, errorCode: 'CHAIN_PERIODIC_LIMIT' })).toBe(base.dragonLine);
  });
});
