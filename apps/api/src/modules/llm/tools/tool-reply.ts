import type { ChatEvent } from '@sikyeoyong/shared';

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
