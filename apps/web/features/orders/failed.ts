import type { OrderView } from '../../lib/api';

/**
 * Failed orders that may pay again on the same order (D-19, payment.md "실패 분류", the same
 * table as the API's failure-class.ts): the payment was refused for a reason that can change
 * (funds, limits, a sleeping dragon, a hiccup before anything was sent). Every other failure
 * (a store that stopped, a price that changed, the owner's no or no answer) needs a new quote.
 */
const RETRYABLE: readonly string[] = [
  'CHAIN_INSUFFICIENT_FUNDS',
  'CHAIN_AGENT_LIMIT_UNSET',
  'MAWS_POLICY_REJECTED',
  'CHAIN_PERIODIC_LIMIT',
  'CHAIN_KYC_LIMIT',
  'CHAIN_AGENT_PAUSED',
  'SERVER_FROZEN',
  'CHAIN_UNAUTHORIZED',
  // Stored on a failed order only when it came before anything was sent.
  'INTERNAL',
];

/** Whether pressing "다시 시도하기" on this failed order may pay again (never on its own, rule 9). */
export function canRetryFailed(order: Pick<OrderView, 'status' | 'errorCode'>): boolean {
  return (
    order.status === 'failed' &&
    order.errorCode !== undefined &&
    RETRYABLE.includes(order.errorCode)
  );
}
