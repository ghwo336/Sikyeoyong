import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  aokrwToString,
  MENU_DESCRIPTION_MAX,
  MENU_NAME_MAX,
  MERCHANT_NAME_MAX,
  type MenuView,
  type MerchantCard,
  type MerchantDetail,
} from '@sikyeoyong/shared';
import {
  MERCHANT_SOURCE,
  type MenuRecord,
  type MerchantRecord,
  type MerchantSource,
} from './merchant-source.js';
import { isOpenAt } from './open-hours.js';

const CATEGORY_MAX = 20;
const TAG_MAX = 20;
const TAGS_MAX = 10;

/** Cuts text to at most `max` UTF-16 units without splitting a character (tech-spec 9.2 caps). */
export function clipText(text: string, max: number): string {
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
}

function clipTags(tags: readonly string[]): string[] {
  return tags
    .map((t) => clipText(t.trim(), TAG_MAX))
    .filter((t) => t !== '')
    .slice(0, TAGS_MAX);
}

/** A menu as other modules read it: price in aokrw bigint, text already clipped. */
export interface MenuItem {
  readonly id: string;
  readonly name: string;
  readonly priceAokrw: bigint;
  readonly tags: readonly string[];
  readonly description: string;
  readonly available: boolean;
}

/** A visible merchant with its menus (recommend reads this). */
export interface CatalogEntry {
  readonly merchant: MerchantCard;
  readonly menus: readonly MenuItem[];
}

/**
 * What the orders module needs before quoting: the merchant, whether it can
 * take an order now, and its menus by id with server prices. `unknown` is an
 * id that does not exist; `not_orderable` is one users must not order from.
 */
export type OrderLookup =
  | { readonly status: 'unknown' }
  | {
      readonly status: 'not_orderable';
      readonly reason: 'unverified' | 'inactive' | 'closed';
    }
  | {
      readonly status: 'ok';
      readonly merchant: MerchantCard;
      readonly menus: ReadonlyMap<string, MenuItem>;
    };

/**
 * Merchants and menus for users, the recommender and the orders module
 * (merchants.md). Rules live here:
 * - Users see only verified and active merchants. Phase 1 decides on the DB
 *   flags; the onchain-registration check joins when the chain seed script
 *   writes onchain_id (merchants.md, open question).
 * - Names, descriptions and tags are merchant-written text, clipped to the
 *   tech-spec 9.2 caps before anyone (screen or model) reads them.
 * - The DB is the only source of prices.
 */
@Injectable()
export class MerchantsService {
  constructor(@Inject(MERCHANT_SOURCE) private readonly source: MerchantSource) {}

  /** GET /api/merchants. Hidden merchants never appear, whatever the filter. */
  list(filter: { readonly category?: string }, nowMs: number = Date.now()): MerchantCard[] {
    return this.source
      .list(filter)
      .filter(isVisible)
      .map((m) => toCard(m, nowMs));
  }

  /** GET /api/merchants/:id. A hidden merchant is NOT_FOUND, the same as a missing one. */
  detail(id: string, nowMs: number = Date.now()): MerchantDetail {
    const m = this.source.get(id);
    if (m === null || !isVisible(m)) {
      throw new AppError('NOT_FOUND', { reason: 'merchant not found' });
    }
    return {
      merchant: toCard(m, nowMs),
      menus: this.source.menus(m.id).map((x) => toMenuView(toItem(x))),
    };
  }

  /** Every visible merchant with its menus, for the recommender. */
  catalog(nowMs: number = Date.now()): CatalogEntry[] {
    return this.source
      .list({})
      .filter(isVisible)
      .map((m) => ({ merchant: toCard(m, nowMs), menus: this.source.menus(m.id).map(toItem) }));
  }

  /** Category of any merchant id, visible or not (recent orders may name a hidden one). */
  categoryOf(id: string): string | null {
    const m = this.source.get(id);
    return m === null ? null : clipText(m.category, CATEGORY_MAX);
  }

  /**
   * For an order already made (any merchant, visible or not): its name and arrival
   * minutes for the status screen, and its on-chain id for paying (null until registered, Q-34).
   */
  orderInfoOf(id: string): { name: string; etaMin: number; onchainId: bigint | null } | null {
    const m = this.source.get(id);
    if (m === null) return null;
    return {
      name: clipText(m.name, MERCHANT_NAME_MAX),
      etaMin: m.etaMin,
      onchainId: m.onchainId === null ? null : BigInt(m.onchainId),
    };
  }

  /** Whether this is one of the seeded mock stores (D-27: demo mode treats them as allowed). */
  isSeeded(id: string): boolean {
    return this.source.get(id)?.source === 'seed';
  }

  /** For the orders module: can this merchant take an order now, and its menu prices. */
  lookupForOrder(merchantId: string, nowMs: number = Date.now()): OrderLookup {
    const m = this.source.get(merchantId);
    if (m === null) return { status: 'unknown' };
    if (!m.verified) return { status: 'not_orderable', reason: 'unverified' };
    if (!m.active) return { status: 'not_orderable', reason: 'inactive' };
    const merchant = toCard(m, nowMs);
    if (!merchant.openNow) return { status: 'not_orderable', reason: 'closed' };
    const menus = new Map(this.source.menus(m.id).map((x) => [x.id, toItem(x)] as const));
    return { status: 'ok', merchant, menus };
  }
}

function isVisible(m: MerchantRecord): boolean {
  return m.verified && m.active;
}

function toCard(m: MerchantRecord, nowMs: number): MerchantCard {
  return {
    id: m.id,
    name: clipText(m.name, MERCHANT_NAME_MAX),
    category: clipText(m.category, CATEGORY_MAX),
    tags: clipTags(m.tags),
    verified: m.verified,
    openNow: isOpenAt(m.openHours, nowMs),
    etaMin: m.etaMin,
  };
}

function toItem(x: MenuRecord): MenuItem {
  return {
    id: x.id,
    name: clipText(x.name, MENU_NAME_MAX),
    priceAokrw: x.priceAokrw,
    tags: clipTags(x.tags),
    description: clipText(x.description, MENU_DESCRIPTION_MAX),
    available: x.available,
  };
}

function toMenuView(x: MenuItem): MenuView {
  return {
    id: x.id,
    name: x.name,
    price: aokrwToString(x.priceAokrw),
    tags: [...x.tags],
    description: x.description,
    available: x.available,
  };
}
