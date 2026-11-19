/**
 * Every error the API returns carries one of these codes (tech-spec 3.6).
 * The table below is the only place that maps a code to an HTTP status,
 * a user message and a dragon line. Words follow design-and-motion.md:
 * no chain words on user screens.
 */
export const APP_ERROR_CODES = [
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
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export interface AppErrorSpec {
  /** HTTP status the API filter answers with. */
  readonly httpStatus: number;
  /** Short sentence for people. No chain words. */
  readonly message: string;
  /**
   * Dragon line template. `{name}` placeholders are filled by renderDragonLine.
   * Values must already be formatted for display (formatOkrw, KST date).
   */
  readonly dragonLine: string;
}

const PAUSED_LINE = '쉬고 있을게용. 깨워 주면 다시 일할게용.';

export const APP_ERRORS: { readonly [C in AppErrorCode]: AppErrorSpec } = {
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
    dragonLine: '제가 할 수 없는 일이에용',
  },
  CHAIN_AGENT_PAUSED: {
    httpStatus: 423,
    message: '용이가 자고 있어요',
    dragonLine: PAUSED_LINE,
  },
  CHAIN_MERCHANT_INACTIVE: {
    httpStatus: 422,
    message: '주문할 수 없는 가게예요',
    dragonLine: '이 가게는 등록이 안 돼 있어용',
  },
  CHAIN_INSUFFICIENT_FUNDS: {
    httpStatus: 422,
    message: '용돈이 부족해요',
    dragonLine: '용돈이 모자라용',
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
    dragonLine: PAUSED_LINE,
  },
  SERVER_BUDGET_OVER: {
    httpStatus: 422,
    message: '이번 달 예산을 넘어요',
    dragonLine: '이번 달 예산을 넘는데 그래도 시킬까용?',
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
    dragonLine: '앗, 요청이 꼬였어용. 처음부터 다시 해 주세용',
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

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && (APP_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Fill `{name}` placeholders. A placeholder without a value is an error,
 * because a dragon line with a raw `{max}` must never reach a screen.
 */
export function renderDragonLine(
  code: AppErrorCode,
  params: Readonly<Record<string, string>> = {},
): string {
  const template = APP_ERRORS[code].dragonLine;
  return template.replace(/\{(\w+)\}/g, (_whole, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new AppError('INTERNAL', { reason: 'missing dragon line param', code, param: name });
    }
    return value;
  });
}

/** Domain error. Throw this, never a string (code-style.md). */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly detail: unknown;

  constructor(code: AppErrorCode, detail?: unknown, options?: { cause?: unknown }) {
    super(APP_ERRORS[code].message, options);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
  }

  get httpStatus(): number {
    return APP_ERRORS[this.code].httpStatus;
  }
}
