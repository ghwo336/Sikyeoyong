import { z } from 'zod';
import { zAokrwString } from '../money/money.js';
import { zDragonMood } from '../domain/dragon-mood.js';
import { APP_ERROR_CODES } from '../errors/app-error-code.js';

/** orders.status (payment.md "confirm 상태 규칙", D-19). */
export const ORDER_STATUSES = [
  'quoted',
  'pending_approval',
  'submitting',
  'paid',
  'preparing',
  'delivering',
  'delivered',
  'failed',
  'cancelled',
  'refunded',
] as const;
export const zOrderStatus = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof zOrderStatus>;

const id = z.string().min(1).max(64);
const minutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

/** One line of an order: the server prices it (menus.price * qty), never the client or the LLM. */
export const zOrderItemLine = z
  .object({
    name: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
    price: zAokrwString,
  })
  .strict();
export type OrderItemLine = z.infer<typeof zOrderItemLine>;

/** One recommended menu (ChatEvent recommendations). */
export const zRecommendationCard = z
  .object({
    id,
    merchantId: id,
    menuId: id,
    store: z.string().min(1),
    etaMin: minutes,
    menu: z.string().min(1),
    price: zAokrwString,
    needsApproval: z.boolean(),
  })
  .strict();
export type RecommendationCard = z.infer<typeof zRecommendationCard>;

/**
 * The confirm card (ChatEvent order_confirm, POST /orders). Limits are the
 * server's numbers after this order. Paying happens only on the card button
 * (POST /orders/:id/confirm, CLAUDE.md rule 3).
 */
export const zOrderQuote = z
  .object({
    orderId: id,
    store: z.string().min(1),
    destination: z.string().min(1),
    etaMin: minutes,
    items: z.array(zOrderItemLine).min(1).max(10),
    request: z.string().max(100).optional(),
    amount: zAokrwString,
    dragonLine: z.string().min(1),
    perOrderLimit: zAokrwString,
    periodUsedAfter: zAokrwString,
    periodCap: zAokrwString,
  })
  .strict();
export type OrderQuote = z.infer<typeof zOrderQuote>;

/**
 * What the chain checked for this payment (Receipt.dc.html 자세히 보기): the dragon's
 * ID-card number (ERC-8004 agentId), the rule names as the server recorded them, and
 * the explorer link for the payment (from the shared chain config, CLAUDE.md rule 2).
 */
export const zOrderReceipt = z
  .object({
    agentId: z.string().regex(/^[0-9]{1,20}$/),
    /** tech-spec 2.5: only what was really checked; layer says who checked it (D-02). */
    rules: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            label: z.string().min(1).max(64),
            layer: z.enum(['chain', 'server']),
            status: z.literal('passed'),
          })
          .strict(),
      )
      .max(10),
    explorerUrl: z.url(),
  })
  .strict();
export type OrderReceipt = z.infer<typeof zOrderReceipt>;

/** GET /orders/:id, the fields the status screens read. */
export const zOrderView = z
  .object({
    id,
    status: zOrderStatus,
    store: z.string().min(1),
    destination: z.string().min(1),
    items: z.array(zOrderItemLine).min(1).max(10),
    request: z.string().max(100).optional(),
    amount: zAokrwString,
    /** unix ms */
    etaAt: z.number().int().nonnegative(),
    remainingMin: minutes,
    dragonLine: z.string().min(1),
    dragonMood: zDragonMood,
    /** Why a failed order stopped (payment.md "실패 분류"); only on failed. */
    errorCode: z.enum(APP_ERROR_CODES).optional(),
    /** Chain transaction of the payment, once paid (영수증 자세히 보기). */
    txHash: z
      .string()
      .regex(/^0x[0-9a-f]{64}$/)
      .optional(),
    /** Receipt.dc.html 자세히 보기, once the server has written the receipt (receipt_json). */
    receipt: zOrderReceipt.optional(),
    /**
     * The limits in force when this order was quoted (the receipt's "그때" values): the
     * per-order limit and the chain's shared 30-day cap. Absent on orders from before the server
     * kept them. Additive and optional (2026-11-21).
     */
    limitsAtOrder: z
      .object({ perOrderLimit: zAokrwString, periodCap: zAokrwString })
      .strict()
      .optional(),
  })
  .strict();
export type OrderView = z.infer<typeof zOrderView>;

/**
 * POST /orders/:id/confirm and GET /orders/:id (tech-spec 3.2). Confirm answers
 * the order as it is after this call, never 409 for its state (D-19).
 */
export const zOrderResult = z.object({ order: zOrderView }).strict();
export type OrderResult = z.infer<typeof zOrderResult>;

/**
 * GET /orders (Main.dc.html 주문 내역 버튼, 진행 중인 주문 카드): the session user's recent orders,
 * newest first, at most ORDER_LIST_MAX. Each is the same view as GET /orders/:id (its status is
 * what the status screens show now). Quoted orders that were never confirmed are left out.
 */
export const ORDER_LIST_MAX = 20;
export const zOrderList = z.object({ orders: z.array(zOrderView).max(ORDER_LIST_MAX) }).strict();
export type OrderList = z.infer<typeof zOrderList>;

/** :id of /orders/:id routes. */
export const zOrderIdParam = id;

/** Arrived.dc.html taste rating: again (또 먹을래), okay (괜찮았어), meh (별로). */
export const TASTE_RATINGS = ['again', 'okay', 'meh'] as const;
export type TasteRating = (typeof TASTE_RATINGS)[number];

/** POST /orders/:id/rating body. A second rating replaces the first. */
export const zRateOrderBody = z.object({ value: z.enum(TASTE_RATINGS) }).strict();
export type RateOrderBody = z.infer<typeof zRateOrderBody>;

/** POST /orders body. The client sends ids and quantities only, never a price. */
export const zCreateOrderBody = z
  .object({
    merchantId: id,
    items: z
      .array(z.object({ menuId: id, qty: z.number().int().min(1).max(20) }).strict())
      .min(1)
      .max(10),
    clientOrderId: id,
  })
  .strict();
export type CreateOrderBody = z.infer<typeof zCreateOrderBody>;

/** POST /orders result: quoted with a quote, or pending_approval without one. */
export const zCreateOrderResult = z
  .object({
    order: z.object({ id, status: zOrderStatus }).strict(),
    quote: zOrderQuote.optional(),
  })
  .strict();
export type CreateOrderResult = z.infer<typeof zCreateOrderResult>;
