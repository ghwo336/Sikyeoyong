import { z } from 'zod';
import { zAgentLevel } from './level.js';
import { APP_ERROR_CODES } from '../errors/app-error-code.js';
import { zAokrwString } from '../money/money.js';
import { zOrderQuote, zRecommendationCard } from './orders.js';

export const zQuickReply = z
  .object({ id: z.string().min(1), label: z.string().min(1).max(30) })
  .strict();
export type QuickReply = z.infer<typeof zQuickReply>;

/** Limit change card (D-21). Names follow the ui LimitChangeCard props. Nothing changes until its button. */
export const zLimitChangeCardView = z
  .object({
    cardId: z.string().min(1),
    field: z.enum(['perOrder', 'monthlyBudget']),
    from: zAokrwString,
    to: zAokrwString,
    levelFrom: zAgentLevel.optional(),
    levelTo: zAgentLevel.optional(),
    needsReauth: z.boolean(),
    rows: z.array(z.object({ label: z.string(), value: z.string() }).strict()),
  })
  .strict();
export type LimitChangeCardView = z.infer<typeof zLimitChangeCardView>;

/**
 * SSE events of POST /api/chat/messages (tech-spec 2.4). order_receipt and
 * approval_request join when the orders and approvals modules define their cards.
 */
export const zChatEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token'), text: z.string() }).strict(),
  z
    .object({
      type: z.literal('tool_status'),
      tool: z.string().min(1),
      state: z.enum(['start', 'done']),
    })
    .strict(),
  z
    .object({ type: z.literal('recommendations'), items: z.array(zRecommendationCard).max(3) })
    .strict(),
  z.object({ type: z.literal('quick_replies'), items: z.array(zQuickReply).max(4) }).strict(),
  z.object({ type: z.literal('order_confirm'), quote: zOrderQuote }).strict(),
  z
    .object({
      type: z.literal('order_failed'),
      code: z.enum(APP_ERROR_CODES),
      dragonLine: z.string().min(1),
    })
    .strict(),
  z.object({ type: z.literal('limit_change_card'), card: zLimitChangeCardView }).strict(),
  z
    .object({
      type: z.literal('nag'),
      level: z.enum(['warn70', 'warn90', 'over100']),
      message: z.string().min(1),
      spent: zAokrwString,
      budget: zAokrwString,
    })
    .strict(),
  z.object({ type: z.literal('done'), messageId: z.string().min(1) }).strict(),
]);
export type ChatEvent = z.infer<typeof zChatEvent>;
export type ChatEventType = ChatEvent['type'];

/** POST /api/chat/messages body. clientMessageId makes a resend idempotent. */
export const zSendChatMessageBody = z
  .object({ text: z.string().trim().min(1).max(500), clientMessageId: z.string().min(1).max(64) })
  .strict();
export type SendChatMessageBody = z.infer<typeof zSendChatMessageBody>;

/** GET /chat/history item (tech-spec 3.2). The dragon's turn is kept as the events it was made of. */
export const zChatHistoryMessage = z.discriminatedUnion('role', [
  z.object({ id: z.string().min(1), role: z.literal('user'), text: z.string() }).strict(),
  z
    .object({ id: z.string().min(1), role: z.literal('dragon'), events: z.array(zChatEvent) })
    .strict(),
]);
export type ChatHistoryMessage = z.infer<typeof zChatHistoryMessage>;

/**
 * GET /chat/history?cursor (tech-spec 3.2). startedAt is the unix ms of the first
 * message shown (the "오늘 오후 12:28" stamp); nextCursor is null on the oldest page.
 */
/** GET /chat/history query: cursor is the id of the oldest message already shown. */
export const zChatHistoryQuery = z
  .object({ cursor: z.string().min(1).max(64).optional() })
  .strict();
export type ChatHistoryQuery = z.infer<typeof zChatHistoryQuery>;

export const zChatHistory = z
  .object({
    startedAt: z.number().int().nonnegative(),
    messages: z.array(zChatHistoryMessage),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();
export type ChatHistory = z.infer<typeof zChatHistory>;
