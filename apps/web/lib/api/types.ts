// API shapes come from packages/shared/src/api (zod schemas the server also uses). This file
// only re-exports them under the names screens already use, and defines the ApiClient the
// screens call. Amounts are aokrw integer strings, as on the wire (CLAUDE.md rule 4).
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
  MeView,
  OrderView,
  QuickReply,
  SignupConfig,
} from '@sikyeoyong/shared';
import type { DragonMood } from '@sikyeoyong/ui';

export type {
  AgentSetupView,
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
  /** POST /chat/messages. The real one is an SSE stream; the mock returns all events at once. */
  sendChatMessage(body: {
    readonly text: string;
    readonly clientMessageId: string;
  }): Promise<readonly ChatEvent[]>;
  createOrder(body: CreateOrderBody): Promise<CreateOrderResult>;
  /** POST /orders/:id/confirm. The only call that pays (CLAUDE.md rule 3). */
  confirmOrder(orderId: string): Promise<{ readonly order: OrderView }>;
  getOrder(orderId: string): Promise<{ readonly order: OrderView }>;

  getSignupConfig(): Promise<SignupConfig>;
  /** Starts OAuth. The real one redirects to the provider; the API sets the session cookie. */
  login(provider: 'kakao' | 'google'): Promise<void>;
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
}
