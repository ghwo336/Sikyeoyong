import { kstDaysBetween, type MerchantCard, type NagStage } from '@sikyeoyong/shared';
import type { CatalogEntry, MenuItem } from '../merchants/merchants.service.js';

/*
 * Deterministic recommendation score (tech-spec 3.8). The server picks, the
 * model only explains. Everything here is integers: money is aokrw bigint,
 * each fit is whole points 0..100, weights are whole numbers, so the same
 * input always gives the same order on every machine.
 */

export const MAX_RECOMMENDATIONS = 3;

/** tech-spec 3.8 weights (0.35, 0.20, 0.20, 0.15, 0.10) as whole points. */
export const WEIGHTS = { affordability: 35, weather: 20, habit: 20, novelty: 15, craving: 10 };
/** tech-spec 3.7 "warn70 이상이면 가격 가중치를 올린다": 35 becomes 55, the rest stay. */
export const NAG_AFFORDABILITY_WEIGHT = 55;

/** tech-spec 3.8 weather tags: rain or cold wants soup, heat wants noodles or cold dishes. */
export const WEATHER_TAGS: Readonly<Record<string, readonly string[]>> = {
  비: ['국물', '따뜻한'],
  눈: ['국물', '따뜻한'],
  추움: ['국물', '따뜻한'],
  더움: ['면', '냉'],
};

const DAY_MS = 86_400_000;
/** Preference looks at the last 30 days of orders. */
export const HABIT_WINDOW_MS = 30 * DAY_MS;
/** Novelty: a merchant ordered from in the last 72 hours gets no bonus. */
export const NOVELTY_WINDOW_MS = 3 * DAY_MS;
/** Craving words shorter than this match too much ("대" is in "대청분식"). */
const MIN_CRAVING_WORD = 2;

export interface RecentOrder {
  readonly merchantId: string;
  /** null when the merchant is gone; such orders still count for novelty. */
  readonly category: string | null;
  readonly createdAtMs: number;
}

export interface RankInput {
  readonly catalog: readonly CatalogEntry[];
  readonly nowMs: number;
  readonly weather: string;
  readonly craving?: string;
  readonly maxPriceAokrw?: bigint;
  /** The per-order limit the owner picked (D-31). */
  readonly perOrderLimitAokrw: bigint;
  /** The owner's own 30-day limit (D-31); spend against it is chainUsedAokrw, the chain's window. */
  readonly myPeriodicLimitAokrw: bigint;
  readonly chainCapAokrw: bigint;
  readonly chainUsedAokrw: bigint;
  /** When the chain's 30-day window ends (unix ms): the daily share spreads what is left until then. */
  readonly periodEndMs: number;
  readonly nagLevel: NagStage;
  readonly frozen: boolean;
  readonly recentOrders: readonly RecentOrder[];
}

/** Points 0..100 per factor; kept on each result so a test (or a log) can see why. */
export interface Fits {
  readonly affordability: number;
  readonly weather: number;
  readonly habit: number;
  readonly novelty: number;
  readonly craving: number;
}

export type ApprovalReason = 'OVER_LEVEL_LIMIT' | 'OVER_PERSONAL_BUDGET';

export interface Recommendation {
  readonly merchant: MerchantCard;
  readonly menu: MenuItem;
  readonly score: number;
  readonly fits: Fits;
  /** Over the per-order limit, or over the owner's 30-day limit (D-31). Code names kept. */
  readonly approvalReason: ApprovalReason | null;
}

export interface RankResult {
  readonly items: readonly Recommendation[];
  /** The craving matched at least one menu, so only matching menus were ranked. */
  readonly cravingMatched: boolean;
  readonly frozen: boolean;
}

/** bigint points (0..100) to a plain number for the score sum. */
function points(x: bigint): number {
  return Number(x);
}

/**
 * Affordability against what is left per day of the 30-day window: 100 up to the daily
 * share, falling in a straight line to 0 at twice the daily share. Nothing left
 * means 0 for every menu.
 */
export function affordabilityFit(costAokrw: bigint, dailyAokrw: bigint): number {
  if (dailyAokrw <= 0n) return 0;
  if (costAokrw <= dailyAokrw) return 100;
  if (costAokrw >= 2n * dailyAokrw) return 0;
  return points((100n * (2n * dailyAokrw - costAokrw)) / dailyAokrw);
}

/** The owner's 30-day limit left per remaining KST day of the chain's window, today included. */
export function dailyShareAokrw(input: RankInput): bigint {
  const left = input.myPeriodicLimitAokrw - input.chainUsedAokrw;
  if (left <= 0n) return 0n;
  const end = Math.max(input.periodEndMs, input.nowMs + 1);
  const daysLeft = kstDaysBetween(input.nowMs, end - 1) + 1;
  return left / BigInt(daysLeft);
}

/** Menu tag hit 100, only the merchant's tags 50, none (or neutral weather) 0. */
export function weatherFit(weather: string, merchant: MerchantCard, menu: MenuItem): number {
  const wanted = WEATHER_TAGS[weather] ?? [];
  if (menu.tags.some((t) => wanted.includes(t))) return 100;
  if (merchant.tags.some((t) => wanted.includes(t))) return 50;
  return 0;
}

/**
 * Share of the last 30 days' orders in this category, in whole percent. Zero
 * when there is no history. Zero as well when the category was ordered on
 * both of the two KST days before today: a third day in a row is not pushed.
 */
export function habitFit(category: string, recent: readonly RecentOrder[], nowMs: number): number {
  const window = recent.filter(
    (o) => o.category !== null && o.createdAtMs <= nowMs && nowMs - o.createdAtMs < HABIT_WINDOW_MS,
  );
  if (window.length === 0) return 0;
  const days = new Set(
    window.filter((o) => o.category === category).map((o) => kstDaysBetween(o.createdAtMs, nowMs)),
  );
  if (days.has(1) && days.has(2)) return 0;
  const same = window.filter((o) => o.category === category).length;
  return Math.floor((100 * same) / window.length);
}

/** 100 unless this merchant was ordered from in the last 72 hours. */
export function noveltyFit(
  merchantId: string,
  recent: readonly RecentOrder[],
  nowMs: number,
): number {
  const lately = recent.some(
    (o) =>
      o.merchantId === merchantId &&
      o.createdAtMs <= nowMs &&
      nowMs - o.createdAtMs < NOVELTY_WINDOW_MS,
  );
  return lately ? 0 : 100;
}

/** Words of the craving worth matching (2 characters or more). */
export function cravingWords(craving: string | undefined): string[] {
  if (craving === undefined) return [];
  return craving
    .split(/[\s,.!?~()]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= MIN_CRAVING_WORD);
}

function wordHits(words: readonly string[], name: string, tags: readonly string[]): boolean {
  return words.some(
    (w) =>
      name.includes(w) ||
      tags.some((t) => t.includes(w) || (t.length >= MIN_CRAVING_WORD && w.includes(t))),
  );
}

/** Craving points for a word in the menu's own name or tags. */
const MENU_MATCH = 100;

/** A word in the menu name or tags 100, only in the merchant name, category or tags 50, else 0. */
export function cravingFit(
  words: readonly string[],
  merchant: MerchantCard,
  menu: MenuItem,
): number {
  if (words.length === 0) return 0;
  if (wordHits(words, menu.name, menu.tags)) return MENU_MATCH;
  if (wordHits(words, merchant.name, [merchant.category, ...merchant.tags])) return 50;
  return 0;
}

interface Candidate extends Recommendation {
  readonly overLimit: boolean;
}

/**
 * Up to three menus to suggest (tech-spec 3.8, recommend-and-nag.md).
 * Left out: closed merchants, unavailable menus, menus over maxPrice, menus the
 * 30-day chain cap would refuse, and everything while the dragon is frozen.
 * Menus over the per-order limit only come in when the user asked for that
 * menu itself (the craving matched its name or tags, not just the merchant
 * or category) and then carry needsApproval; menus within the limit
 * always rank first. With a matching craving only matching menus are ranked
 * and one merchant may fill several slots; without one each merchant gets its
 * best menu only. Ties go to the cheaper menu, then by id.
 */
export function rank(input: RankInput): RankResult {
  if (input.frozen) return { items: [], cravingMatched: false, frozen: true };
  const daily = dailyShareAokrw(input);
  const words = cravingWords(input.craving);
  const weights = {
    ...WEIGHTS,
    affordability: input.nagLevel === 'none' ? WEIGHTS.affordability : NAG_AFFORDABILITY_WEIGHT,
  };

  const all: Candidate[] = [];
  for (const { merchant, menus } of input.catalog) {
    if (!merchant.openNow) continue;
    for (const menu of menus) {
      const cost = menu.priceAokrw;
      if (!menu.available) continue;
      if (input.maxPriceAokrw !== undefined && cost > input.maxPriceAokrw) continue;
      if (input.chainUsedAokrw + cost > input.chainCapAokrw) continue;
      const fits: Fits = {
        affordability: affordabilityFit(cost, daily),
        weather: weatherFit(input.weather, merchant, menu),
        habit: habitFit(merchant.category, input.recentOrders, input.nowMs),
        novelty: noveltyFit(merchant.id, input.recentOrders, input.nowMs),
        craving: cravingFit(words, merchant, menu),
      };
      const score =
        weights.affordability * fits.affordability +
        weights.weather * fits.weather +
        weights.habit * fits.habit +
        weights.novelty * fits.novelty +
        weights.craving * fits.craving;
      const overLimit = cost > input.perOrderLimitAokrw;
      // Same rule as the order check: the owner's limit is the server's only below the chain cap.
      // The cap test documents D-31; results match either way (cap overrun is refused first).
      const overMonth =
        input.myPeriodicLimitAokrw < input.chainCapAokrw &&
        input.chainUsedAokrw + cost > input.myPeriodicLimitAokrw;
      const approvalReason: ApprovalReason | null = overLimit
        ? 'OVER_LEVEL_LIMIT'
        : overMonth
          ? 'OVER_PERSONAL_BUDGET'
          : null;
      all.push({ merchant, menu, score, fits, approvalReason, overLimit });
    }
  }

  const cravingMatched = all.some((c) => c.fits.craving > 0);
  const pool = cravingMatched
    ? all.filter((c) => (c.overLimit ? c.fits.craving === MENU_MATCH : c.fits.craving > 0))
    : all.filter((c) => !c.overLimit);
  pool.sort(compare);

  const items: Recommendation[] = [];
  const seen = new Set<string>();
  for (const c of pool) {
    if (items.length >= MAX_RECOMMENDATIONS) break;
    if (!cravingMatched && seen.has(c.merchant.id)) continue;
    seen.add(c.merchant.id);
    items.push({
      merchant: c.merchant,
      menu: c.menu,
      score: c.score,
      fits: c.fits,
      approvalReason: c.approvalReason,
    });
  }
  return { items, cravingMatched, frozen: false };
}

function compare(a: Candidate, b: Candidate): number {
  if (a.overLimit !== b.overLimit) return a.overLimit ? 1 : -1;
  if (a.score !== b.score) return b.score - a.score;
  if (a.menu.priceAokrw !== b.menu.priceAokrw)
    return a.menu.priceAokrw < b.menu.priceAokrw ? -1 : 1;
  if (a.merchant.id !== b.merchant.id) return a.merchant.id < b.merchant.id ? -1 : 1;
  return a.menu.id < b.menu.id ? -1 : a.menu.id > b.menu.id ? 1 : 0;
}
