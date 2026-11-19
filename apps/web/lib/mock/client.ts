// A fake API server in the browser, so screens can be walked end to end before apps/api has
// these routes. Only lib/api imports this file; hooks see the ApiClient interface only.
// It never pays: confirmOrder just flips the mock order to preparing (CLAUDE.md rule 3).
import { AppError, type BudgetView, getPolicy, nagStage, parseAokrw } from '@sikyeoyong/shared';
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

// The fake server's memory. Sign-up changes the dragon and the budget Main then shows.
let me: MeView = ME;
let budget: BudgetView = BUDGET;
let hatchStartedAt: number | undefined;

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
function reply(text: string): ChatEvent[] {
  const rec = RECOMMENDATIONS.find((r) => !r.needsApproval && text.includes(r.menu));
  if (rec) return [{ type: 'order_confirm', quote: quoteFor(rec) }];
  const cheapest = [...RECOMMENDATIONS].sort((a, b) =>
    parseAokrw(a.price) < parseAokrw(b.price) ? -1 : 1,
  )[0];
  const events: ChatEvent[] = [];
  if (text.includes('싼') && cheapest) {
    events.push({ type: 'token', text: `${cheapest.menu}이 제일 싸용.` });
    events.push({ type: 'recommendations', items: [cheapest] });
  } else {
    events.push({ type: 'token', text: '알겠어용. 다시 골라 봤어용.' });
    events.push({ type: 'recommendations', items: [...RECOMMENDATIONS] });
  }
  return events;
}

export const mockApi: ApiClient = {
  getMe: () => later(me),
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
  login: () => later(undefined),
  verifyIdentity: () => later({ verified: true }),
  createAgent: ({ dragonName, dragonSpecies }) => {
    me = { ...me, dragonName, dragonSpecies };
    hatchStartedAt = Date.now();
    return later({ agent: { id: 'agent-1', status: 'PENDING' as const } });
  },
  getAgentSetup: () => later(agentSetup(Date.now())),
  retryAgentSetup: () => {
    hatchStartedAt = Date.now();
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
