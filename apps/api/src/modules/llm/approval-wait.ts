import type { ChatEvent, QuickReply } from '@sikyeoyong/shared';
import type { ApprovalReason } from '../approvals/approvals.service.js';

/**
 * What the dragon says when an order waits for the owner (agent-runtime.md "허락 대기").
 * Server words, not the model's, so no turn can claim an approval that never happened.
 * Each line says what stopped the order and what the user can do now; the chips send the
 * user's own words, so a limit card still opens only from the user's message (D-21).
 */
export const APPROVAL_WAIT: Record<
  ApprovalReason,
  { readonly line: string; readonly replies: readonly QuickReply[] }
> = {
  OVER_LEVEL_LIMIT: {
    line: '이건 제가 한 번에 쓸 수 있는 돈보다 커서 아직 못 시켰어용. 한 번에 쓸 돈을 올리거나 더 싼 걸 골라 주세용.',
    replies: [
      { id: 'raise-per-order', label: '한 번에 쓸 돈 올려 줘' },
      { id: 'cheaper', label: '더 싼 걸로 골라 줘' },
    ],
  },
  OVER_PERSONAL_BUDGET: {
    line: '이걸 시키면 30일에 쓸 돈을 넘어서 아직 못 시켰어용. 30일에 쓸 돈을 올리거나 더 싼 걸 골라 주세용.',
    replies: [
      { id: 'raise-my-periodic', label: '30일에 쓸 돈 올려 줘' },
      { id: 'cheaper', label: '더 싼 걸로 골라 줘' },
    ],
  },
  NEW_MERCHANT: {
    line: '처음 시키는 가게라 주인님 허락이 있어야 해서 아직 못 시켰어용. 지금은 시켜 본 가게에서 골라 주세용.',
    replies: [{ id: 'known-store', label: '시켜 본 가게에서 골라 줘' }],
  },
};

/** The wait's screen events: the line (on a new line after the model's words) and its chips. */
export function approvalWaitEvents(reason: ApprovalReason, afterWords: boolean): ChatEvent[] {
  const wait = APPROVAL_WAIT[reason];
  return [
    { type: 'token', text: afterWords ? `\n${wait.line}` : wait.line },
    { type: 'quick_replies', items: [...wait.replies] },
  ];
}
