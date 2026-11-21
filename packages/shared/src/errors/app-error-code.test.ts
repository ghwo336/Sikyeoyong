import { describe, expect, it } from 'vitest';
import {
  APP_ERROR_CODES,
  APP_ERRORS,
  AppError,
  isAppErrorCode,
  renderDragonLine,
  type AppErrorCode,
} from './app-error-code.js';

// Copied by hand from docs/tech-spec.md 3.6. Not derived from the code on purpose:
// if the code and the spec drift apart, this test must fail.
const EXPECTED: Record<AppErrorCode, { httpStatus: number; message: string; dragonLine: string }> =
  {
    CHAIN_AGENT_LIMIT: {
      httpStatus: 422,
      message: '건당 한도를 넘었어요',
      dragonLine: '한 번에 {max}까지만 쓸 수 있어용. 주인님 허락받아 올게용!',
    },
    CHAIN_PERIODIC_LIMIT: {
      httpStatus: 422,
      message: '30일 상한에 도달했어요',
      dragonLine: '이번 30일 배달비를 다 썼어용. {resetAt}부터 다시 시킬 수 있어용',
    },
    CHAIN_AGENT_LIMIT_UNSET: {
      httpStatus: 503,
      message: '용이 설정이 덜 끝났어요',
      dragonLine: '앗, 제 한도가 아직 안 정해졌어용. 잠깐만용',
    },
    CHAIN_KYC_LIMIT: {
      httpStatus: 422,
      message: '본인 인증이 없어 한도가 막혔어요',
      dragonLine: '주인님 본인 인증이 필요해용',
    },
    CHAIN_EAS_REQUIRED: {
      httpStatus: 422,
      message: '인증이 없거나 만료된 가게예요',
      dragonLine: '이 가게는 인증이 없어서 못 시켜용',
    },
    CHAIN_UNAUTHORIZED: {
      httpStatus: 500,
      message: '잠시 후 다시 시도해 주세요',
      dragonLine: '앗, 뭔가 꼬였어용. 조금 있다 다시 해 주세용',
    },
    CHAIN_AGENT_PAUSED: {
      httpStatus: 423,
      message: '용이가 자고 있어요',
      dragonLine: '쉬고 있을게용. 깨워 주면 다시 일할게용.',
    },
    CHAIN_MERCHANT_INACTIVE: {
      httpStatus: 422,
      message: '주문할 수 없는 가게예요',
      dragonLine: '지금은 이 가게에서 못 시켜용. 다른 가게를 골라 주세용',
    },
    CHAIN_INSUFFICIENT_FUNDS: {
      httpStatus: 422,
      message: '용돈이 부족해요',
      dragonLine: '용돈이 모자라용',
    },
    CHAIN_ORDER_EXISTS: {
      httpStatus: 409,
      message: '이미 결제된 주문이에요',
      dragonLine: '이 주문은 벌써 시켰어용. 주문 내역을 확인해 주세용',
    },
    MAWS_POLICY_REJECTED: {
      httpStatus: 422,
      message: '용이 규칙에 걸렸어요',
      dragonLine: '용이 규칙에 걸렸어용',
    },
    SERVER_OVER_LEVEL: {
      httpStatus: 422,
      message: '승인이 필요해요',
      dragonLine: '이건 제 한도보다 비싸용. 허락해 주실래용?',
    },
    SERVER_NEW_MERCHANT: {
      httpStatus: 422,
      message: '처음 보는 가게예요',
      dragonLine: '처음 가는 가게라 주인님 확인이 필요해용',
    },
    SERVER_FROZEN: {
      httpStatus: 423,
      message: '용이가 자고 있어요',
      dragonLine: '쉬고 있을게용. 깨워 주면 다시 일할게용.',
    },
    SERVER_BUDGET_OVER: {
      httpStatus: 422,
      message: '이번 달 예산을 넘어요',
      dragonLine: '이번 달 예산을 넘는데 그래도 시킬까용?',
    },
    SERVER_PRICE_CHANGED: {
      httpStatus: 422,
      message: '가격이 바뀌었어요',
      dragonLine: '가게 가격이 바뀌었어용. 새 금액을 다시 확인해 주세용',
    },
    VALIDATION_FAILED: {
      httpStatus: 400,
      message: '요청 형식이 맞지 않아요',
      dragonLine: '앗, 무슨 말인지 잘 모르겠어용',
    },
    UNAUTHENTICATED: {
      httpStatus: 401,
      message: '다시 로그인해 주세요',
      dragonLine: '주인님, 다시 로그인해 주세용',
    },
    FORBIDDEN: {
      httpStatus: 403,
      message: '권한이 없어요',
      dragonLine: '제가 할 수 없는 일이에용',
    },
    NOT_FOUND: {
      httpStatus: 404,
      message: '찾을 수 없어요',
      dragonLine: '어디 있는지 못 찾겠어용',
    },
    CONFLICT: {
      httpStatus: 409,
      message: '요청이 서로 맞지 않아요',
      dragonLine: '앗, 요청이 꼬였어용. 주문 내역을 먼저 확인해 주세용',
    },
    RATE_LIMITED: {
      httpStatus: 429,
      message: '잠시 후 다시 시도해 주세요',
      dragonLine: '숨 좀 돌리고 올게용',
    },
    INTERNAL: {
      httpStatus: 500,
      message: '잠시 후 다시 시도해 주세요',
      dragonLine: '앗, 뭔가 꼬였어용',
    },
  };

// design-and-motion.md "쓰지 않는 말" column, all of it.
const BANNED_WORDS = [
  '지갑',
  '주소',
  '시드',
  'OKRW',
  '토큰',
  '트랜잭션',
  '해시',
  '탐색기',
  '가스',
  'KYC',
  'attestation',
  '에이전트',
  '8004',
  '정책',
  'PCL',
  'revert',
  '동결',
  '블록체인',
];

describe('AppErrorCode table', () => {
  it.each(APP_ERROR_CODES)('%s matches tech-spec 3.6 exactly', (code) => {
    expect(APP_ERRORS[code]).toEqual(EXPECTED[code]);
  });

  it('spec table and code list have the same codes', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...APP_ERROR_CODES].sort());
  });

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
        'CHAIN_ORDER_EXISTS',
        'MAWS_POLICY_REJECTED',
        'SERVER_OVER_LEVEL',
        'SERVER_NEW_MERCHANT',
        'SERVER_FROZEN',
        'SERVER_BUDGET_OVER',
        'SERVER_PRICE_CHANGED',
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
      'SERVER_PRICE_CHANGED',
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

  it('never tells the user to start over on CONFLICT (double payment risk)', () => {
    const { message, dragonLine } = APP_ERRORS.CONFLICT;
    expect(`${message} ${dragonLine}`).not.toMatch(/처음부터|새로|다시 시켜|다시 주문/);
    expect(dragonLine).toContain('주문 내역');
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
