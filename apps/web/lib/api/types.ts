// API shapes come from packages/shared/src/api (zod schemas the server also uses). This file
// only re-exports them under the names screens already use, and defines the ApiClient the
// screens call. Amounts are aokrw integer strings, as on the wire (CLAUDE.md rule 4).
import type { PouchiBindBody, PouchiCompleteBody, PouchiLoginConfig } from '@sikyeoyong/shared';
import type {
  AGENT_SETUP_STEP_KEYS,
  AgentSetupView,
  BudgetView,
  ChatEvent,
  ChatHistory,
  CreateOrderBody,
  CreateOrderResult,
  DragonMoodKey,
  DragonSpecies,
  IdCardView,
  MeView,
  OrderView,
  QuickReply,
  SignupConfig,
  WalletView,
} from '@sikyeoyong/shared';
import type { DragonMood } from '@sikyeoyong/ui';

export type {
  AgentSetupView,
  LimitChangeCardView,
  IdCardView,
  WalletView,
  ChatEvent,
  ChatHistory,
  ChatHistoryMessage,
  CreateOrderBody,
  CreateOrderResult,
  MeView,
  OrderItemLine,
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
  /** POST /orders/:id/confirm. The only call that pays (CLAUDE.md rule 3). */
  confirmOrder(orderId: string): Promise<{ readonly order: OrderView }>;
  getOrder(orderId: string): Promise<{ readonly order: OrderView }>;
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
  /** POST /agents. */
  createAgent(body: {
    readonly dragonName: string;
    readonly dragonSpecies: DragonSpecies;
  }): Promise<{ readonly agent: { readonly id: string; readonly status: 'PENDING' } }>;
  getAgentSetup(): Promise<AgentSetupView>;
  /** "다시 깨우기" after a failed setup. */
  retryAgentSetup(): Promise<void>;
  /** PATCH /me monthlyBudgetOkrw (aokrw string). */
  setMonthlyBudget(amount: AokrwString): Promise<void>;
  /** Trial allowance into the owner's pocket (user-flow 5). Not a payment. */
  claimTrialAllowance(): Promise<void>;

  /** Wallet.dc.html money: the owner's allowance, the dragon's pocket, saved this month. */
  getWallet(): Promise<WalletView>;
  /** IdCard.dc.html: who owns the dragon, the identity check, when it hatched. */
  getIdCard(): Promise<IdCardView>;
  /** 용이 멈추기 / 깨우기 (user-flow 17). The owner's switch; never an LLM tool. */
  setFrozen(frozen: boolean): Promise<void>;
  /**
   * Raise the dragon's level (user-flow 12, 13): the owner's button after re-auth (D-28).
   * Never an LLM tool; propose_limit_change only shows the card (D-21).
   */
  raiseLevel(level: 1 | 2 | 3): Promise<void>;
  /** 돌려받기 on the Frozen screen: the pocket goes back to the owner's allowance. */
  refundPocket(): Promise<void>;
}
