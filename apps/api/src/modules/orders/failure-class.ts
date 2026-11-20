import type { AppErrorCode } from '@sikyeoyong/shared';

/**
 * payment.md "실패 분류" (D-19), the source of this table:
 * - approval: ask the owner, the order goes to pending_approval;
 * - retryable: settled, no orderRef left on chain, the same order may pay later;
 * - final: this order cannot happen, a new quote is needed;
 * - unrelated: refused before any transition (not about this order);
 * - unknown: everything else, the order stays submitting (never a new quote).
 */
export type FailureClass = 'approval' | 'retryable' | 'final' | 'unrelated' | 'unknown';

const CLASS_OF: Partial<Record<AppErrorCode, FailureClass>> = {
  SERVER_OVER_LEVEL: 'approval',
  SERVER_NEW_MERCHANT: 'approval',
  SERVER_BUDGET_OVER: 'approval',
  CHAIN_AGENT_LIMIT: 'approval',
  CHAIN_INSUFFICIENT_FUNDS: 'retryable',
  CHAIN_AGENT_LIMIT_UNSET: 'retryable',
  MAWS_POLICY_REJECTED: 'retryable',
  CHAIN_PERIODIC_LIMIT: 'retryable',
  CHAIN_KYC_LIMIT: 'retryable',
  CHAIN_AGENT_PAUSED: 'retryable',
  SERVER_FROZEN: 'retryable',
  CHAIN_UNAUTHORIZED: 'retryable',
  CHAIN_MERCHANT_INACTIVE: 'final',
  CHAIN_EAS_REQUIRED: 'final',
  NOT_FOUND: 'final',
  SERVER_PRICE_CHANGED: 'final',
  VALIDATION_FAILED: 'unrelated',
  UNAUTHENTICATED: 'unrelated',
  FORBIDDEN: 'unrelated',
  CONFLICT: 'unrelated',
  RATE_LIMITED: 'unrelated',
};

/**
 * The class of a refusal. INTERNAL is unknown here: it is retryable only when it
 * came before the submit-start marker, which the caller knows and passes.
 */
export function classify(code: AppErrorCode, beforeMarker = false): FailureClass {
  if (code === 'INTERNAL') return beforeMarker ? 'retryable' : 'unknown';
  return CLASS_OF[code] ?? 'unknown';
}

/** Whether a failed order with this stored error_code may pay again on confirm. */
export function isRetryableFailure(errorCode: string | null): boolean {
  // INTERNAL is stored on failed only when it came before the marker (retryable).
  if (errorCode === 'INTERNAL') return true;
  return errorCode !== null && CLASS_OF[errorCode as AppErrorCode] === 'retryable';
}
