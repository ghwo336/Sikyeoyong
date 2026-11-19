// A fake API server in the browser, so screens can be walked end to end before apps/api has
// these routes. Only lib/api imports this file; hooks see the ApiClient interface only.
// It never pays: confirmOrder just flips the mock order to preparing (CLAUDE.md rule 3).
import { AppError, parseAokrw } from '@sikyeoyong/shared';
import type {
  ApiClient,
  ChatEvent,
  CreateOrderBody,
  CreateOrderResult,
  OrderQuote,
  OrderView,
  RecommendationCard,
} from '../api/types';
import { BUDGET, chatHistory, DESTINATION, ME, MENU_EXTRA, RECOMMENDATIONS } from './fixtures';

const LATENCY_MS = 250;

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
    perOrderLimit: BUDGET.perOrderLimit,
    periodUsedAfter: (parseAokrw(BUDGET.chainUsed) + amount).toString(),
    periodCap: BUDGET.chainCap,
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
    events.push({ type: 'recommendations', items: RECOMMENDATIONS });
  }
  return events;
}

export const mockApi: ApiClient = {
  getMe: () => later(ME),
  getBudget: () => later(BUDGET),
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
};
