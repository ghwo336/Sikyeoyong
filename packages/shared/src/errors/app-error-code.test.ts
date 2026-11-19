import { describe, expect, it } from 'vitest';
import {
  APP_ERROR_CODES,
  APP_ERRORS,
  AppError,
  isAppErrorCode,
  renderDragonLine,
} from './app-error-code.js';

const BANNED_WORDS = [
  '지갑',
  '토큰',
  '트랜잭션',
  'KYC',
  'PCL',
  '블록체인',
  '가스',
  '해시',
  'OKRW',
  '정책',
  'revert',
];

describe('AppErrorCode table', () => {
  it('has exactly the codes from tech-spec 3.6 plus the HTTP codes', () => {
    expect([...APP_ERROR_CODES].sort()).toEqual(
      [
        'CHAIN_AGENT_LIMIT',
        'CHAIN_PERIODIC_LIMIT',
        'CHAIN_AGENT_LIMIT_UNSET',
        'CHAIN_KYC_LIMIT',
        'CHAIN_EAS_REQUIRED',
        'CHAIN_UNAUTHORIZED',
        'CHAIN_AGENT_PAUSED',
        'CHAIN_MERCHANT_INACTIVE',
        'CHAIN_INSUFFICIENT_FUNDS',
        'MAWS_POLICY_REJECTED',
        'SERVER_OVER_LEVEL',
        'SERVER_NEW_MERCHANT',
        'SERVER_FROZEN',
        'SERVER_BUDGET_OVER',
        'VALIDATION_FAILED',
        'UNAUTHENTICATED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'RATE_LIMITED',
        'INTERNAL',
      ].sort(),
    );
    expect(new Set(APP_ERROR_CODES).size).toBe(APP_ERROR_CODES.length);
  });

  it('maps HTTP codes to their standard statuses', () => {
    expect(APP_ERRORS.VALIDATION_FAILED.httpStatus).toBe(400);
    expect(APP_ERRORS.UNAUTHENTICATED.httpStatus).toBe(401);
    expect(APP_ERRORS.FORBIDDEN.httpStatus).toBe(403);
    expect(APP_ERRORS.NOT_FOUND.httpStatus).toBe(404);
    expect(APP_ERRORS.CONFLICT.httpStatus).toBe(409);
    expect(APP_ERRORS.RATE_LIMITED.httpStatus).toBe(429);
    expect(APP_ERRORS.INTERNAL.httpStatus).toBe(500);
  });

  it('answers chain and server rule rejections with a 4xx the user can act on', () => {
    for (const code of [
      'CHAIN_AGENT_LIMIT',
      'CHAIN_PERIODIC_LIMIT',
      'CHAIN_KYC_LIMIT',
      'CHAIN_EAS_REQUIRED',
      'CHAIN_MERCHANT_INACTIVE',
      'CHAIN_INSUFFICIENT_FUNDS',
      'SERVER_OVER_LEVEL',
      'SERVER_NEW_MERCHANT',
      'SERVER_BUDGET_OVER',
    ] as const) {
      expect(APP_ERRORS[code].httpStatus, code).toBe(422);
    }
    expect(APP_ERRORS.CHAIN_AGENT_PAUSED.httpStatus).toBe(423);
    expect(APP_ERRORS.SERVER_FROZEN.httpStatus).toBe(423);
  });

  it.each(APP_ERROR_CODES)('%s has a message and dragon line without chain words', (code) => {
    const spec = APP_ERRORS[code];
    expect(spec.message.length).toBeGreaterThan(0);
    expect(spec.dragonLine.length).toBeGreaterThan(0);
    for (const word of BANNED_WORDS) {
      expect(spec.message, `${code} message`).not.toContain(word);
      expect(spec.dragonLine, `${code} dragonLine`).not.toContain(word);
    }
    expect(spec.message.endsWith('용')).toBe(false);
    expect(spec.dragonLine).toMatch(/용[.!?]?$/);
  });

  it('has no em dash or en dash', () => {
    const all = JSON.stringify(APP_ERRORS);
    expect(all).not.toContain(String.fromCodePoint(0x2014));
    expect(all).not.toContain(String.fromCodePoint(0x2013));
  });
});

describe('isAppErrorCode', () => {
  it('accepts known codes and rejects everything else', () => {
    expect(isAppErrorCode('CHAIN_AGENT_LIMIT')).toBe(true);
    expect(isAppErrorCode('chain_agent_limit')).toBe(false);
    expect(isAppErrorCode('')).toBe(false);
    expect(isAppErrorCode(undefined)).toBe(false);
    expect(isAppErrorCode(422)).toBe(false);
    expect(isAppErrorCode('toString')).toBe(false);
  });
});

describe('renderDragonLine', () => {
  it('fills placeholders', () => {
    expect(renderDragonLine('CHAIN_AGENT_LIMIT', { max: '10,000원' })).toBe(
      '한 번에 10,000원까지만 쓸 수 있어용. 주인님 허락받아 올게용!',
    );
    expect(renderDragonLine('CHAIN_PERIODIC_LIMIT', { resetAt: '12월 3일' })).toBe(
      '이번 30일 배달비를 다 썼어용. 12월 3일부터 다시 시킬 수 있어용',
    );
  });

  it('returns lines without placeholders unchanged', () => {
    expect(renderDragonLine('INTERNAL')).toBe('앗, 뭔가 꼬였어용');
  });

  it('throws instead of leaking a raw placeholder', () => {
    expect(() => renderDragonLine('CHAIN_AGENT_LIMIT')).toThrow(AppError);
    expect(() => renderDragonLine('CHAIN_AGENT_LIMIT', { other: 'x' })).toThrow(AppError);
  });

  it('does not treat replacement patterns in values as special', () => {
    expect(renderDragonLine('CHAIN_AGENT_LIMIT', { max: '$& $1' })).toContain('$& $1');
  });
});

describe('AppError', () => {
  it('carries code, status, message, detail and cause', () => {
    const cause = new Error('rpc');
    const err = new AppError('CHAIN_AGENT_LIMIT', { maxLimit: '1' }, { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AppError');
    expect(err.code).toBe('CHAIN_AGENT_LIMIT');
    expect(err.httpStatus).toBe(422);
    expect(err.message).toBe('건당 한도를 넘었어요');
    expect(err.detail).toEqual({ maxLimit: '1' });
    expect(err.cause).toBe(cause);
  });
});
