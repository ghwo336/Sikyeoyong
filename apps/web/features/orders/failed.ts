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

/**
 * What the dragon says on a stopped order's screen. The server's line for some codes asks a
 * question ("그래도 시킬까용?") that only a retry could answer; when this order has no retry the
 * screen has one button (back to the chat), so the line says what is true and where to go
 * (QA 6 L2). Lines that are not questions, and orders that can retry, keep the server's words.
 */
export function stoppedLine(order: Pick<OrderView, 'status' | 'errorCode' | 'dragonLine'>): string {
  if (canRetryFailed(order) || !order.dragonLine.trim().endsWith('?')) return order.dragonLine;
  return order.errorCode === 'SERVER_BUDGET_OVER'
    ? '이번 달 예산을 넘어서 멈췄어용. 다시 시키려면 대화에서 골라 주세용.'
    : '이 주문은 멈췄어용. 다시 시키려면 대화에서 골라 주세용.';
}
