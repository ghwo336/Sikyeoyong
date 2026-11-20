// A fake API server in the browser, so screens can be walked end to end before apps/api has
// these routes. Only lib/api imports this file; hooks see the ApiClient interface only.
// It never pays: confirmOrder just flips the mock order to preparing (CLAUDE.md rule 3).
import {
  type AgentLevel,
  AppError,
  type BudgetView,
  formatKstDateTime,
  explorerTxUrl,
  formatOkrw,
  NETWORKS,
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
  WalletView,
} from '../api/types';
import {
  BUDGET,
  chatHistory,
  DESTINATION,
  ME,
  MENU_EXTRA,
  ID_CARD,
  RECOMMENDATIONS,
  SIGNUP,
  WALLET,
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
  /** The dragon's level (1 until raised). */
  level?: AgentLevel;
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
let wallet: WalletView = WALLET;

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
  wallet = WALLET;
  paid.clear();
  waiting.clear();
  saveSession();
}

const levelPolicy = getPolicy('default');
const levelOf = (): AgentLevel => session.level ?? 1;
const perOrderOf = (level: AgentLevel): bigint => levelPolicy.perOrderLimitAokrw[level];

function currentMe(): MeView {
  if (!session.signedIn) throw new AppError('UNAUTHENTICATED', { reason: 'mock: signed out' });
  if (session.dragon === null) throw new AppError('NOT_FOUND', { reason: 'mock: no dragon' });
  return {
    ...ME,
    dragonName: session.dragon.name,
    dragonSpecies: session.dragon.species,
    level: levelOf(),
    perOrderLimit: perOrderOf(levelOf()).toString(),
  };
}

/** The budget view with the session's level (raised by raiseLevel). */
function currentBudget(): BudgetView {
  return { ...budget, level: levelOf(), perOrderLimit: perOrderOf(levelOf()).toString() };
}

/** Recommendations as the server would mark them now: over the level's limit asks the owner. */
function recommendationsNow(): RecommendationCard[] {
  return RECOMMENDATIONS.map((r) => ({
    ...r,
    needsApproval: parseAokrw(r.price) > perOrderOf(levelOf()),
  }));
}

function later<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, LATENCY_MS);
  });
}

const orderIdOf = (menuId: string) => `order-${menuId}`;

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

/** Demo pace (the real one is the store's minutes): 20 s cooking, then 20 s on the road. */
const COOK_MS = 20_000;
const RIDE_MS = 20_000;
/** The rules a paid order passed, as the Receipt design lists them. */
const RECEIPT_RULES = [
  'AGENT_OKRW_TRANSFER_LIMIT_POLICY',
  'PERIODIC_VOLUME_POLICY',
  '전역 KYC 한도',
  'EAS_POLICY (가게 등록 때)',
];

/** A made-up 32-byte hash for the mock receipt (stable per menu, clearly not a real payment). */
function mockTxHash(menuId: string): string {
  let hex = '';
  for (let i = 0; i < menuId.length; i += 1) {
    hex += (menuId.charCodeAt(i) % 256).toString(16).padStart(2, '0');
  }
  return `0x${hex.padEnd(64, '0').slice(0, 64)}`;
}

/** The order as it is `now`, paid at `paidAt`: cooking, then on the road, then arrived. */
function orderAt(rec: RecommendationCard, paidAt: number, now: number): OrderView {
  const extra = MENU_EXTRA[rec.menuId];
  const elapsed = Math.max(0, now - paidAt);
  const total = COOK_MS + RIDE_MS;
  const status = elapsed < COOK_MS ? 'preparing' : elapsed < total ? 'delivering' : 'delivered';
  const remainingMin = Math.max(0, Math.ceil(rec.etaMin * (1 - elapsed / total)));
  const [dragonLine, dragonMood] =
    status === 'preparing'
      ? [extra?.cookingLine ?? '만드는 중이에용.\n출발하면 알려 줄게용.', 'cooking' as const]
      : status === 'delivering'
        ? ['라이더님 출발했어용!\n숟가락 준비해용.', 'excited' as const]
        : [`문 앞에 ${rec.menu} 왔어용. 맛있게 먹어용!`, 'eating' as const];
  const txHash = mockTxHash(rec.menuId);
  return {
    id: orderIdOf(rec.menuId),
    status,
    store: rec.store,
    destination: DESTINATION,
    items: [{ name: rec.menu, quantity: 1, price: rec.price }],
    request: extra?.request,
    amount: rec.price,
    etaAt: paidAt + rec.etaMin * 60_000,
    remainingMin,
    dragonLine,
    dragonMood,
    txHash,
    receipt: {
      agentId: '1042',
      rules: RECEIPT_RULES,
      explorerUrl: explorerTxUrl(NETWORKS['maroo-testnet'], txHash),
    },
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

/** Paid mock orders: which menu and when it was paid (the state follows from the time). */
const paid = new Map<string, { rec: RecommendationCard; at: number }>();
const ratings = new Map<string, 'again' | 'okay' | 'meh'>();

/** Orders waiting for the owner (over the level's limit): the Blocked screen reads them. */
const waiting = new Map<string, RecommendationCard>();

/** Unix seconds an hour from now: the demo profile's window length (a time, not money). */
function anHourFromNowSec(): number {
  return Math.floor(Date.now() / 1000) + 3_600;
}

/** The 30-day window (demo profile): opens with the first payment, refills an hour later. */
function refuseOverCap(amount: bigint): void {
  const used = parseAokrw(budget.chainUsed);
  if (used + amount <= parseAokrw(budget.chainCap)) return;
  const resetAtSec = budget.chainResetAtSec ?? anHourFromNowSec();
  budget = { ...budget, chainResetAtSec: resetAtSec };
  throw new AppError('CHAIN_PERIODIC_LIMIT', {
    dragonParams: { resetAt: formatKstDateTime(resetAtSec * 1000) },
  });
}

function createOrder(body: CreateOrderBody): CreateOrderResult {
  const first = body.items[0];
  const rec = first ? recommendationsNow().find((r) => r.menuId === first.menuId) : undefined;
  if (!rec || rec.merchantId !== body.merchantId) {
    throw new AppError('NOT_FOUND', { reason: 'mock menu not found' });
  }
  const id = orderIdOf(rec.menuId);
  refuseOverCap(parseAokrw(rec.price));
  // Over the level's per-order limit: it waits for the owner (tech-spec flow 2, 3). No quote.
  if (rec.needsApproval) {
    waiting.set(id, rec);
    return { order: { id, status: 'pending_approval' } };
  }
  waiting.delete(id);
  return { order: { id, status: 'quoted' }, quote: quoteFor(rec) };
}

/** A payment uses the 30-day window and this month's budget, like the chain and the server. */
function spend(amount: bigint): void {
  const spent = parseAokrw(budget.personalSpent) + amount;
  budget = {
    ...budget,
    personalSpent: spent.toString(),
    nagLevel: nagStage(getPolicy('default'), spent, parseAokrw(budget.personalBudget)),
    chainUsed: (parseAokrw(budget.chainUsed) + amount).toString(),
    chainResetAtSec: budget.chainResetAtSec ?? anHourFromNowSec(),
  };
}

/** Stand-in for the LLM: a menu name orders it, anything else gets the recommendations again. */
const BUDGET_WORDS = ['예산', '다 쓴', '다쓴', '남았', '얼마'];
const LIMIT_WORDS = ['올려', '한도'];
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
  const rec = recommendationsNow().find((r) => !r.needsApproval && text.includes(r.menu));
  if (rec) return [{ type: 'order_confirm', quote: quoteFor(rec) }];
  const cheapest = recommendationsNow().sort((a, b) =>
    parseAokrw(a.price) < parseAokrw(b.price) ? -1 : 1,
  )[0];
  if (text.includes('싼') && cheapest) {
    return [
      { type: 'token', text: `${cheapest.menu}이 제일 싸용.` },
      { type: 'recommendations', items: [cheapest] },
    ];
  }
  if (LIMIT_WORDS.some((w) => text.includes(w)) && levelOf() < 3) {
    // LimitChat.dc.html: a card only; the change waits for the owner's button (D-21).
    return [
      { type: 'token', text: '와, 레벨 3이 되는 거예용? 이렇게 바꿀까용?' },
      {
        type: 'limit_change_card',
        card: {
          cardId: `limit-${String(Date.now())}`,
          field: 'perOrder',
          from: perOrderOf(levelOf()).toString(),
          to: perOrderOf(3).toString(),
          levelFrom: levelOf(),
          levelTo: 3,
          needsReauth: true,
          rows: [
            { label: '30일 한도', value: `${formatOkrw(parseAokrw(budget.chainCap))} 그대로` },
          ],
        },
      },
    ];
  }
  if (BUDGET_WORDS.some((w) => text.includes(w))) return [{ type: 'token', text: budgetLine() }];
  if (FOOD_WORDS.some((w) => text.includes(w))) {
    return [
      { type: 'token', text: '알겠어용. 골라 봤어용.' },
      { type: 'recommendations', items: recommendationsNow() },
    ];
  }
  return [{ type: 'token', text: '음, 그건 잘 모르겠어용. 뭐 먹고 싶은지 말해 주세용.' }];
}

export const mockApi: ApiClient = {
  getMe: () => later(null).then(currentMe),
  getBudget: () => later(null).then(currentBudget),
  getChatHistory: () => later(chatHistory(Date.now())),
  sendChatMessage: ({ text, clientMessageId }) =>
    later([...reply(text), { type: 'done', messageId: `reply-${clientMessageId}` }]),
  // Refusals come back as a rejected promise, like the HTTP client, never a sync throw.
  createOrder: (body) => later(null).then(() => createOrder(body)),
  confirmOrder: (orderId) => {
    const rec = RECOMMENDATIONS.find((r) => orderIdOf(r.menuId) === orderId);
    if (!rec) return Promise.reject(new AppError('NOT_FOUND', { reason: 'mock order' }));
    // Pays nothing here: the order just starts its clock (CLAUDE.md rule 3 holds on the server).
    return later(null).then(() => {
      const before = paid.get(orderId);
      if (!before) {
        refuseOverCap(parseAokrw(rec.price));
        spend(parseAokrw(rec.price));
      }
      const at = before?.at ?? Date.now();
      paid.set(orderId, { rec, at });
      return { order: orderAt(rec, at, Date.now()) };
    });
  },
  getOrder: (orderId) => {
    // Only a confirmed order exists. A reload loses the mock's memory, like a server restart.
    const p = paid.get(orderId);
    const w = waiting.get(orderId);
    if (!p && w) {
      return later({
        order: {
          ...orderAt(w, Date.now(), Date.now()),
          status: 'pending_approval' as const,
          dragonLine: '주인님 허락을 기다려용.',
          dragonMood: 'worried' as const,
          txHash: undefined,
          receipt: undefined,
        },
      });
    }
    if (!p) return Promise.reject(new AppError('NOT_FOUND', { reason: 'mock order' }));
    return later(null).then(() => ({ order: orderAt(p.rec, p.at, Date.now()) }));
  },
  raiseLevel: (level) => {
    session = { ...session, level };
    saveSession();
    return later(undefined);
  },
  rateOrder: (orderId, value) => {
    ratings.set(orderId, value);
    return later(undefined);
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
  getWallet: () => later(wallet),
  getIdCard: () => later(ID_CARD),
  setFrozen: (frozen) => {
    budget = { ...budget, frozen };
    return later(undefined);
  },
  refundPocket: () => {
    // Like drain: everything in the pocket goes back to the owner, nothing is paid.
    const owner = parseAokrw(wallet.owner) + parseAokrw(wallet.pocket);
    wallet = { ...wallet, owner: owner.toString(), pocket: '0' };
    return later(undefined);
  },
};
