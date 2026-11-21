import type { ChatEvent } from '@sikyeoyong/shared';
import type { ApprovalReason } from '../../approvals/approvals.service.js';

/** Card events a tool may put on screen. */
export type ToolCard = Extract<
  ChatEvent,
  { type: 'recommendations' | 'order_confirm' | 'limit_change_card' }
>;

/**
 * A tool result with two faces (agent-runtime.md "모델용과 화면용"):
 * - `forModel` goes back to the model inside <data>: display text only
 *   ("9,000원", KST words), never aokrw integers or unix times.
 * - `card` goes to the screen as a ChatEvent (aokrw strings, ids) and never
 *   reaches the model.
 * A handler that returns a plain value has no card; that value is the model's.
 */
export class ToolReply {
  constructor(
    readonly forModel: unknown,
    readonly card: ToolCard,
  ) {}
}

/**
 * An order now waits for the owner (place_order APPROVAL_REQUIRED, request_owner_approval
 * APPROVAL_REQUESTED). The owner has decided nothing yet. From here the runtime shows no more
 * model words in this message and the server says the wait itself (agent-runtime.md "허락
 * 대기"), so no model turn can claim an approval that never happened (browser QA).
 */
export class ApprovalWait {
  constructor(
    readonly forModel: unknown,
    readonly reason: ApprovalReason,
    /** The waiting order, so the screen can show the owner's approval card for it. */
    readonly orderId: string,
  ) {}
}
