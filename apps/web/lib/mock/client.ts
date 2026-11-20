// A fake API server in the browser, so screens can be walked end to end before apps/api has
// these routes. Only lib/api imports this file; hooks see the ApiClient interface only.
// It never pays: confirmOrder just flips the mock order to preparing (CLAUDE.md rule 3).
import {
  AppError,
  type BudgetView,
  formatOkrw,
  getPolicy,
  nagStage,
  parseAokrw,
} from '@sikyeoyong/shared';
import type {
  AgentSetupView,
  ApiClient,
  MeView,
  ChatEvent,
  CreateOrderBody,
  CreateOrderResult,
  OrderQuote,
  OrderView,
  RecommendationCard,
} from '../api/types';
import {
  BUDGET,
  chatHistory,
  DESTINATION,
  ME,
  MENU_EXTRA,
  RECOMMENDATIONS,
  SIGNUP,
} from './fixtures';

const LATENCY_MS = 250;
/** How long each hatch step takes in the mock (the real one is 1 to 3 minutes). */
const HATCH_STEP_MS = 1_500;

/**
 * Who is signed in, kept for the tab (sessionStorage) so a reload stays on the same step.
 * A new tab starts signed out, like a first visit: Start, Verify, Name, Hatch, Budget, Main.
 */
interface MockSession {
  signedIn: boolean;
  dragon: { name: string; species: MeView['dragonSpecies']; hatchStartedAt: number } | null;
}
const SESSION_KEY = 'sikyeoyong.mock.session';

function loadSession(): MockSession {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as MockSession;
  } catch {
    // Private mode or no storage: start signed out.
  }
  return { signedIn: false, dragon: null };
}

function saveSession(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // The mock still works for this page; a reload starts over.
  }
}

// The fake server's memory. Sign-up changes the dragon and the budget Main then shows.
let session: MockSession = loadSession();
let budget: BudgetView = BUDGET;

/** Tests set where the mock starts (signed in with a hatched dragon, or a first visit). */
export function resetMockSession(next: 'first-visit' | 'hatched'): void {
  session =
    next === 'hatched'
      ? {
          signedIn: true,
          dragon: { name: ME.dragonName, species: ME.dragonSpecies, hatchStartedAt: 0 },
        }
      : { signedIn: false, dragon: null };
  budget = BUDGET;
  saveSession();
}

function currentMe(): MeView {
  if (!session.signedIn) throw new AppError('UNAUTHENTICATED', { reason: 'mock: signed out' });
  if (session.dragon === null) throw new AppError('NOT_FOUND', { reason: 'mock: no dragon' });
  return { ...ME, dragonName: session.dragon.name, dragonSpecies: session.dragon.species };
}

function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, LATENCY_MS);
  });
}

const orderIdOf = (menuId: string) => `order-${menuId}`;

function recByMenu(menuId: string): RecommendationCard | undefined {
  return RECOMMENDATIONS.find((r) => r.menuId === menuId);
}

/** What the server would quote for one recommended menu. */
function quoteFor(rec: RecommendationCard): OrderQuote {
  const extra = MENU_EXTRA[rec.menuId];
  const amount = parseAokrw(rec.price);
  return {
    orderId: orderIdOf(rec.menuId),
    store: rec.store,
    destination: DESTINATION,
    etaMin: rec.etaMin,
    items: [{ name: rec.menu, quantity: 1, price: rec.price }],
    request: extra?.request,
    amount: rec.price,
    dragonLine: extra?.confirmLine ?? `${rec.menu} 시킬게용.\n이대로 괜찮아용?`,
    perOrderLimit: budget.perOrderLimit,
    periodUsedAfter: (parseAokrw(budget.chainUsed) + amount).toString(),
    periodCap: budget.chainCap,
  };
}

function preparingOrder(rec: RecommendationCard, now: number): OrderView {
  const extra = MENU_EXTRA[rec.menuId];
  return {
    id: orderIdOf(rec.menuId),
    status: 'preparing',
    store: rec.store,
    destination: DESTINATION,
    items: [{ name: rec.menu, quantity: 1, price: rec.price }],
    request: extra?.request,
    amount: rec.price,
    etaAt: now + rec.etaMin * 60_000,
    remainingMin: rec.etaMin,
    dragonLine: extra?.cookingLine ?? '만드는 중이에용.\n출발하면 알려 줄게용.',
    dragonMood: 'cooking',
  };
}

/** Steps finish one after another, HATCH_STEP_MS apart (Hatch.dc.html). */
function agentSetup(now: number): AgentSetupView {
  const keys = ['wallet', 'identity', 'limit'] as const;
  const hatchStartedAt = session.dragon?.hatchStartedAt;
  if (hatchStartedAt === undefined) {
    return { status: 'PENDING', steps: keys.map((key) => ({ key, status: 'waiting' })) };
  }
  const done = Math.floor((now - hatchStartedAt) / HATCH_STEP_MS);
  return {
    status: done >= keys.length ? 'ACTIVE' : 'PENDING',
    steps: keys.map((key, i) => ({
      key,
      status: i < done ? 'done' : i === done ? 'doing' : 'waiting',
    })),
  };
}

const orders = new Map<string, OrderView>();

function createOrder(body: CreateOrderBody): CreateOrderResult {
  const first = body.items[0];
  const rec = first ? recByMenu(first.menuId) : undefined;
  if (!rec || rec.merchantId !== body.merchantId) {
    throw new AppError('NOT_FOUND', { reason: 'mock menu not found' });
  }
  const id = orderIdOf(rec.menuId);
  // A store seen for the first time waits for the owner (tech-spec flow 3). No quote yet.
  if (rec.needsApproval) return { order: { id, status: 'pending_approval' } };
  return { order: { id, status: 'quoted' }, quote: quoteFor(rec) };
}

/** Stand-in for the LLM: a menu name orders it, anything else gets the recommendations again. */
const BUDGET_WORDS = ['예산', '다 쓴', '다쓴', '남았', '얼마'];
const FOOD_WORDS = ['시켜', '추천', '점심', '저녁', '배고', '먹'];

/** The dragon's words about this month's budget, from the mock's own numbers. */
function budgetLine(): string {
  const spent = parseAokrw(budget.personalSpent);
  const limit = parseAokrw(budget.personalBudget);
  if (spent > limit) {
    return `이번 달 예산 ${formatOkrw(limit)}을 벌써 ${formatOkrw(spent - limit)} 넘었어용. 더 시키면 주인님 허락을 받을게용.`;
  }
  return `이번 달 ${formatOkrw(spent)} 썼고 ${formatOkrw(limit - spent)} 남았어용.`;
}

/**
 * The mock dragon understands a few kinds of words only (a real reply comes from Claude):
 * a menu name opens its confirm card, "싼" the cheapest, budget words the budget, food
 * words the recommendations. Anything else gets a line and no cards, so it never repeats.
 */
function reply(text: string): ChatEvent[] {
  const rec = RECOMMENDATIONS.find((r) => !r.needsApproval && text.includes(r.menu));
  if (rec) return [{ type: 'order_confirm', quote: quoteFor(rec) }];
  const cheapest = [...RECOMMENDATIONS].sort((a, b) =>
    parseAokrw(a.price) < parseAokrw(b.price) ? -1 : 1,
  )[0];
  if (text.includes('싼') && cheapest) {
    return [
      { type: 'token', text: `${cheapest.menu}이 제일 싸용.` },
      { type: 'recommendations', items: [cheapest] },
    ];
  }
  if (BUDGET_WORDS.some((w) => text.includes(w))) return [{ type: 'token', text: budgetLine() }];
  if (FOOD_WORDS.some((w) => text.includes(w))) {
    return [
      { type: 'token', text: '알겠어용. 골라 봤어용.' },
      { type: 'recommendations', items: [...RECOMMENDATIONS] },
    ];
  }
  return [{ type: 'token', text: '음, 그건 잘 모르겠어용. 뭐 먹고 싶은지 말해 주세용.' }];
}

export const mockApi: ApiClient = {
  getMe: () => later(null).then(currentMe),
  getBudget: () => later(budget),
  getChatHistory: () => later(chatHistory(Date.now())),
  sendChatMessage: ({ text, clientMessageId }) =>
    later([...reply(text), { type: 'done', messageId: `reply-${clientMessageId}` }]),
  createOrder: (body) => later(createOrder(body)),
  confirmOrder: (orderId) => {
    const rec = RECOMMENDATIONS.find((r) => orderIdOf(r.menuId) === orderId);
    if (!rec) return Promise.reject(new AppError('NOT_FOUND', { reason: 'mock order' }));
    // Like the server: submitting at once (no payment here), accepted by the store after a beat.
    const order = preparingOrder(rec, Date.now());
    orders.set(orderId, { ...order, status: 'submitting' });
    return later(null).then(() => {
      orders.set(orderId, order);
      return { order };
    });
  },
  getOrder: (orderId) => {
    // Only a confirmed order exists. A reload loses the mock's memory, like a server restart.
    const saved = orders.get(orderId);
    if (!saved) return Promise.reject(new AppError('NOT_FOUND', { reason: 'mock order' }));
    return later({ order: saved });
  },
  getSignupConfig: () => later(SIGNUP),
  login: () => {
    session = { ...session, signedIn: true };
    saveSession();
    return later(undefined);
  },
  verifyIdentity: () => later({ verified: true }),
  createAgent: ({ dragonName, dragonSpecies }) => {
    session = {
      ...session,
      dragon: { name: dragonName, species: dragonSpecies, hatchStartedAt: Date.now() },
    };
    saveSession();
    return later({ agent: { id: 'agent-1', status: 'PENDING' as const } });
  },
  getAgentSetup: () => later(agentSetup(Date.now())),
  retryAgentSetup: () => {
    if (session.dragon !== null) {
      session = { ...session, dragon: { ...session.dragon, hatchStartedAt: Date.now() } };
      saveSession();
    }
    return later(undefined);
  },
  setMonthlyBudget: (amount) => {
    const spent = parseAokrw(budget.personalSpent);
    const nagLevel = nagStage(getPolicy('default'), spent, parseAokrw(amount));
    budget = { ...budget, personalBudget: amount, nagLevel };
    return later(undefined);
  },
  claimTrialAllowance: () => later(undefined),
};
