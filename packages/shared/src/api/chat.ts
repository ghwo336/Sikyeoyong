import { z } from 'zod';
import { APP_ERROR_CODES } from '../errors/app-error-code.js';
import { zAokrwString } from '../money/money.js';
import { zApprovalReason } from './approvals.js';
import { zOrderQuote, zRecommendationCard } from './orders.js';

export const zQuickReply = z
  .object({ id: z.string().min(1), label: z.string().min(1).max(30) })
  .strict();
export type QuickReply = z.infer<typeof zQuickReply>;

export const LIMIT_FIELDS = ['perOrder', 'myPeriodic'] as const;
export type LimitField = (typeof LIMIT_FIELDS)[number];

/**
 * Limit change card (D-21, D-31). Names follow the ui LimitChangeCard props. Nothing changes
 * until its button. perOrder is the per-order limit, myPeriodic the owner's 30-day limit.
 */
export const zLimitChangeCardView = z
  .object({
    cardId: z.string().min(1),
    field: z.enum(LIMIT_FIELDS),
    from: zAokrwString,
    to: zAokrwString,
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
  /**
   * An order now waits for the owner (new store, 30-day limit, or over the per-order limit).
   * The screen shows the owner's approval card for orderId (or the Blocked screen for the
   * per-order reason); the dragon's words for the wait follow as token events.
   */
  z
    .object({
      type: z.literal('approval_request'),
      orderId: z.string().min(1).max(64),
      reason: zApprovalReason,
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

/**
 * The meal's conversation the message belongs to (D-34); absent on messages from before
 * sessions. The screen folds a session that differs from the newest one.
 */
const sessionId = z.string().min(1).nullable();

/** GET /chat/history item (tech-spec 3.2). The dragon's turn is kept as the events it was made of. */
export const zChatHistoryMessage = z.discriminatedUnion('role', [
  z
    .object({
      id: z.string().min(1),
      role: z.literal('user'),
      text: z.string(),
      sessionId: sessionId.optional(),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      role: z.literal('dragon'),
      events: z.array(zChatEvent),
      sessionId: sessionId.optional(),
    })
    .strict(),
]);
export type ChatHistoryMessage = z.infer<typeof zChatHistoryMessage>;

/** GET /chat/history query: cursor is the id of the oldest message already shown. */
export const zChatHistoryQuery = z
  .object({ cursor: z.string().min(1).max(64).optional() })
  .strict();
export type ChatHistoryQuery = z.infer<typeof zChatHistoryQuery>;

/**
 * GET /chat/history?cursor (tech-spec 3.2). startedAt is the unix ms of the first
 * message shown (the "오늘 오후 12:28" stamp), or now when the page is empty;
 * nextCursor is null on the oldest page.
 */
export const zChatHistory = z
  .object({
    startedAt: z.number().int().nonnegative(),
    messages: z.array(zChatHistoryMessage),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();
export type ChatHistory = z.infer<typeof zChatHistory>;
