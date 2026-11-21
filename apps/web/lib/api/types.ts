// API shapes come from packages/shared/src/api (zod schemas the server also uses). This file
// only re-exports them under the names screens already use, and defines the ApiClient the
// screens call. Amounts are aokrw integer strings, as on the wire (CLAUDE.md rule 4).
import type { PouchiBindBody, PouchiCompleteBody, PouchiLoginConfig } from '@sikyeoyong/shared';
import type {
  AGENT_SETUP_STEP_KEYS,
  AgentSetupView,
  ApprovalDecision,
  ApprovalList,
  BudgetView,
  ChatEvent,
  ChatHistory,
  CreateOrderBody,
  CreateOrderResult,
  OpenQuoteResult,
  DragonMoodKey,
  DragonSpecies,
  IdCardView,
  MeView,
  OrderList,
  OrderView,
  PatchAgentBody,
  PatchAgentResult,
  QuickReply,
  SetLimitsBody,
  SetLimitsResult,
  SignupConfig,
  WalletView,
  LeakCompareView,
} from '@sikyeoyong/shared';
import type { DragonMood } from '@sikyeoyong/ui';

export type {
  AgentSetupView,
  ApprovalDecision,
  ApprovalList,
  ApprovalView,
  LimitChangeCardView,
  IdCardView,
  WalletView,
  LeakCompareView,
  ChatEvent,
  ChatHistory,
  ChatHistoryMessage,
  CreateOrderBody,
  CreateOrderResult,
  MeView,
  OrderItemLine,
  OrderList,
  OrderQuote,
  OrderStatus,
  OrderView,
  RecommendationCard,
  SignupConfig,
} from '@sikyeoyong/shared';

export type AokrwString = string;
export type QuickReplyItem = QuickReply;
export type AgentSetupStepKey = (typeof AGENT_SETUP_STEP_KEYS)[number];
export type AgentSetupStepStatus = AgentSetupView['steps'][number]['status'];

// The server's mood list and the ui Dragon's must be the same set (compile-time check both ways).
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
true satisfies Same<DragonMoodKey, DragonMood>;

/** Everything the screens call. lib/api picks the implementation (mock now, HTTP later). */
export interface ApiClient {
  getMe(): Promise<MeView>;
  getBudget(): Promise<BudgetView>;
  getChatHistory(): Promise<ChatHistory>;
  /**
   * POST /chat/messages. onEvent gets each event as it arrives (the SSE stream), so the screen
   * shows the words while the dragon is still writing; the promise resolves with all of them.
   */
  sendChatMessage(
    body: { readonly text: string; readonly clientMessageId: string },
    onEvent?: (event: ChatEvent) => void,
  ): Promise<readonly ChatEvent[]>;
  createOrder(body: CreateOrderBody): Promise<CreateOrderResult>;
  /** GET /orders/open-quote. The confirm card to bring back after a reload (reads only, pays nothing). */
  getOpenQuote(): Promise<OpenQuoteResult>;
  /** POST /orders/:id/confirm. The only call that pays (CLAUDE.md rule 3). */
  confirmOrder(orderId: string): Promise<{ readonly order: OrderView }>;
  /**
   * POST /orders/:id/requote: after a per-order raise from Blocked, the order that waited for it
   * comes back with its confirm card (user-flow 12). Never pays; the sheet's button still does.
   */
  requoteOrder(orderId: string): Promise<CreateOrderResult>;
  /**
   * GET /approvals?status=pending: orders waiting for the owner's yes (a new store, the 30-day
   * limit; a per-order wait is listed too but its way out is the limit screens, not this).
   */
  listApprovals(): Promise<ApprovalList>;
  /**
   * POST /approvals/:id/approve: the owner's button. Never pays: the order is quoted again and
   * its confirm card comes back. A per-order wait answers 400 (raise the limit instead).
   */
  approveApproval(approvalId: string): Promise<ApprovalDecision>;
  /** POST /approvals/:id/reject: the order stops for good. */
  rejectApproval(approvalId: string): Promise<ApprovalDecision>;
  getOrder(orderId: string): Promise<{ readonly order: OrderView }>;
  /**
   * GET /orders: the owner's recent orders, newest first, at most ORDER_LIST_MAX, quotes never
   * confirmed left out (Main.dc.html: the order in progress card and the 주문 내역 button).
   */
  listOrders(): Promise<OrderList>;
  /** Arrived.dc.html taste rating; it feeds later recommendations. */
  rateOrder(orderId: string, value: 'again' | 'okay' | 'meh'): Promise<void>;

  getSignupConfig(): Promise<SignupConfig>;
  /** Starts OAuth. The real one redirects to the provider; the API sets the session cookie. */
  /**
   * The direct login without the vault: the mock's, or the API dev login (DEV_LOGIN, a
   * NEXT_PUBLIC_DEV_LOGIN_KEY). The real login (Pouchi vault, D-29) goes through
   * lib/session/entry.ts, which uses the three calls below.
   */
  login(): Promise<void>;
  /** GET /identity: whether the owner passed the identity check (the front door asks). */
  getIdentity(): Promise<{ verified: boolean }>;
  /** D-29 Pouchi login: the public vault config (GET /auth/pouchi/config). */
  getPouchiLoginConfig(): Promise<PouchiLoginConfig>;
  /** Binds one vault request on the server before the vault opens. */
  pouchiBind(body: PouchiBindBody): Promise<void>;
  /** Redeems the vault's result once; the server sets the session cookie. */
  pouchiComplete(body: PouchiCompleteBody): Promise<void>;
  /** Kakao identity check (or the trial check in mock mode). Only the result is kept. */
  verifyIdentity(): Promise<{ readonly verified: boolean }>;
  /**
   * PATCH /agents/:id (Look.dc.html, D-32): the dragon's look only. The owner's button; nothing
   * goes on chain and the name, money and limits stay. agentId comes from GET /me.
   */
  patchAgent(agentId: string, body: PatchAgentBody): Promise<PatchAgentResult>;
  /** POST /agents. */
  createAgent(body: {
    readonly dragonName: string;
    readonly dragonSpecies: DragonSpecies;
  }): Promise<{ readonly agent: { readonly id: string; readonly status: 'PENDING' } }>;
  getAgentSetup(): Promise<AgentSetupView>;
  /** "다시 깨우기" after a failed setup. */
  retryAgentSetup(): Promise<void>;
  /** Trial allowance into the owner's pocket (user-flow 5). Not a payment. */
  claimTrialAllowance(): Promise<void>;

  /** Wallet.dc.html money: the owner's allowance, the dragon's pocket, saved this month. */
  getWallet(): Promise<WalletView>;
  /** LeakCompare.dc.html (demo scene 5): the numbers for the key leak comparison. 404 when DEMO_MODE is off. */
  getLeakCompare(): Promise<LeakCompareView>;
  /** IdCard.dc.html: who owns the dragon, the identity check, when it hatched. */
  getIdCard(): Promise<IdCardView>;
  /** 용이 멈추기 / 깨우기 (user-flow 17). The owner's switch; never an LLM tool. */
  setFrozen(frozen: boolean): Promise<void>;
  /**
   * PUT /agents/me/limits (D-31): the per-order limit and/or the owner's 30-day limit, aokrw
   * strings. The owner's button only, after re-auth when raising (D-28). Never an LLM tool;
   * propose_limit_change only shows the card (D-21).
   */
  setLimits(body: SetLimitsBody): Promise<SetLimitsResult>;
  /** 돌려받기 on the Frozen screen: the pocket goes back to the owner's allowance. */
  refundPocket(): Promise<void>;
}
