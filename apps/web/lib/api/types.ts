// TODO: packages/shared/src/api로 교체
// Temporary web-side shapes for the API (tech-spec 2.4, 3.x). packages/shared/src/api has only
// zBudgetView so far. When shared gets these schemas, delete each one here and import it instead.
// Amounts are aokrw integer strings, as on the wire (CLAUDE.md rule 4).
import type { AgentLevel, BudgetView, DragonSpecies } from '@sikyeoyong/shared';
import type { DragonMood } from '@sikyeoyong/ui';

export type AokrwString = string;

/** GET /me (tech-spec 3.x). Only the fields screens read so far. */
export interface MeView {
  readonly dragonName: string;
  readonly dragonSpecies: DragonSpecies;
  readonly level: AgentLevel;
  /** aokrw, the per-order limit of this level. */
  readonly perOrderLimit: AokrwString;
}

/** One recommended menu (ChatEvent recommendations, RecommendationCard). */
export interface RecommendationCard {
  readonly id: string;
  readonly merchantId: string;
  readonly menuId: string;
  readonly store: string;
  readonly etaMin: number;
  readonly menu: string;
  readonly price: AokrwString;
  readonly needsApproval: boolean;
}

export interface OrderItemLine {
  readonly name: string;
  readonly quantity: number;
  /** aokrw for the whole line. */
  readonly price: AokrwString;
}

/** The confirm card (ChatEvent order_confirm). Limits are the server's numbers after this order. */
export interface OrderQuote {
  readonly orderId: string;
  readonly store: string;
  readonly destination: string;
  readonly etaMin: number;
  readonly items: readonly OrderItemLine[];
  readonly request?: string;
  readonly amount: AokrwString;
  readonly dragonLine: string;
  readonly perOrderLimit: AokrwString;
  readonly periodUsedAfter: AokrwString;
  readonly periodCap: AokrwString;
}

/** orders.status (tech-spec 5). */
export type OrderStatus =
  | 'quoted'
  | 'pending_approval'
  | 'submitting'
  | 'paid'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'refunded';

/** GET /orders/:id (only the fields the status screens read so far). */
export interface OrderView {
  readonly id: string;
  readonly status: OrderStatus;
  readonly store: string;
  readonly destination: string;
  readonly items: readonly OrderItemLine[];
  readonly request?: string;
  readonly amount: AokrwString;
  /** unix ms, from the server. */
  readonly etaAt: number;
  readonly remainingMin: number;
  readonly dragonLine: string;
  readonly dragonMood: DragonMood;
}

export interface QuickReplyItem {
  readonly id: string;
  readonly label: string;
}

/**
 * Subset of ChatEvent (tech-spec 2.4). `quick_replies` is not in the spec yet: Main.dc.html shows
 * reply chips, so the server needs to send them (recorded in web.md).
 */
export type ChatEvent =
  | { readonly type: 'token'; readonly text: string }
  | { readonly type: 'recommendations'; readonly items: readonly RecommendationCard[] }
  | { readonly type: 'quick_replies'; readonly items: readonly QuickReplyItem[] }
  | { readonly type: 'order_confirm'; readonly quote: OrderQuote }
  | { readonly type: 'done'; readonly messageId: string };

/** GET /chat/history item. The dragon's message is kept as the events it was made of. */
export type ChatHistoryMessage =
  | { readonly id: string; readonly role: 'user'; readonly text: string }
  | { readonly id: string; readonly role: 'dragon'; readonly events: readonly ChatEvent[] };

export interface ChatHistory {
  /** unix ms of the first message today. */
  readonly startedAt: number;
  readonly messages: readonly ChatHistoryMessage[];
}

export interface CreateOrderBody {
  readonly merchantId: string;
  readonly items: readonly { readonly menuId: string; readonly qty: number }[];
  readonly clientOrderId: string;
}

/** POST /orders: quoted (with a quote) or pending_approval (no quote, approval card later). */
export interface CreateOrderResult {
  readonly order: { readonly id: string; readonly status: OrderStatus };
  readonly quote?: OrderQuote;
}

/** Everything the screens call. lib/api picks the implementation (mock now, HTTP later). */
export interface ApiClient {
  getMe(): Promise<MeView>;
  getBudget(): Promise<BudgetView>;
  getChatHistory(): Promise<ChatHistory>;
  /** POST /chat/messages. The real one is an SSE stream; the mock returns all events at once. */
  sendChatMessage(body: {
    readonly text: string;
    readonly clientMessageId: string;
  }): Promise<readonly ChatEvent[]>;
  createOrder(body: CreateOrderBody): Promise<CreateOrderResult>;
  /** POST /orders/:id/confirm. The only call that pays (CLAUDE.md rule 3). */
  confirmOrder(orderId: string): Promise<{ readonly order: OrderView }>;
  getOrder(orderId: string): Promise<{ readonly order: OrderView }>;
}
