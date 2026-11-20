import {
  aokrwToString,
  formatOkrw,
  type MerchantDetail,
  parseAokrw,
  type RecommendationCard,
} from '@sikyeoyong/shared';
import type {
  EmptyReason,
  EmptyResult,
  Recommendation,
  RecommendResult,
} from '../../recommend/recommend.service.js';
import { ToolReply } from './tool-reply.js';

/*
 * What recommend_merchants and get_menu give the model, and the screen card.
 * The model gets display words only: prices as "9,000원" (formatOkrw), never
 * aokrw integers (agent-runtime.md MUST). Merchant names and descriptions are
 * merchant-written text, already clipped to tech-spec 9.2 caps by
 * MerchantsService, and reach the model only inside the runtime's <data>.
 */

/** Server-made reasons the model may repeat; it never has to work them out from numbers. */
function reasons(r: Recommendation): string[] {
  const out: string[] = [];
  if (r.fits.craving > 0) out.push('말한 것과 맞음');
  if (r.fits.weather > 0) out.push('지금 날씨에 맞음');
  if (r.fits.affordability === 100) out.push('남은 예산의 하루 몫 안');
  if (r.fits.novelty === 100) out.push('최근 3일 안 시킨 가게');
  return out;
}

/** What the dragon may say when nothing came back: the server's reason, in display words. */
const EMPTY_SAY: Record<EmptyReason, string> = {
  FROZEN: '용이가 멈춰 있어서 추천하지 않는다.',
  ALL_CLOSED: '지금 문을 연 가게가 없다.',
  NO_MENU: '문을 연 가게에 지금 파는 메뉴가 없다.',
  OVER_ASKED_PRICE: '말한 값 안에 드는 메뉴가 없다.',
  OVER_30_DAY_CAP: '30일에 쓸 수 있는 돈이 남지 않아 시킬 수 있는 메뉴가 없다.',
  OVER_PER_ORDER_LIMIT: '문을 연 가게의 메뉴가 모두 한 번에 쓸 수 있는 돈보다 비싸다.',
};

function emptyForModel(empty: EmptyResult | null) {
  if (empty === null) return null;
  return {
    reason: empty.reason,
    say: EMPTY_SAY[empty.reason],
    cheapestPrice: empty.cheapestAokrw === null ? null : formatOkrw(empty.cheapestAokrw),
    perOrderLimit: formatOkrw(empty.perOrderLimitAokrw),
    rule: '후보가 없는 까닭은 say와 reason뿐이다. 날씨나 메뉴 탓을 하지 않는다.',
  };
}

function recommendationsForModel(result: RecommendResult) {
  return {
    weather: result.weather,
    frozen: result.frozen,
    cravingMatched: result.cravingMatched,
    empty: emptyForModel(result.empty),
    candidates: result.items.map((r) => ({
      merchantId: r.merchant.id,
      store: r.merchant.name,
      category: r.merchant.category,
      menuId: r.menu.id,
      menu: r.menu.name,
      description: r.menu.description,
      price: formatOkrw(r.menu.priceAokrw),
      etaMin: r.merchant.etaMin,
      needsApproval: r.approvalReason !== null,
      approvalReason: r.approvalReason,
      reasons: reasons(r),
    })),
  };
}

/** ChatEvent recommendations: aokrw strings and ids for the screen (zRecommendationCard). */
function recommendationCards(result: RecommendResult): RecommendationCard[] {
  return result.items.map((r) => ({
    id: r.menu.id,
    merchantId: r.merchant.id,
    menuId: r.menu.id,
    store: r.merchant.name,
    etaMin: r.merchant.etaMin,
    menu: r.menu.name,
    price: aokrwToString(r.menu.priceAokrw),
    needsApproval: r.approvalReason !== null,
  }));
}

export function recommendReply(result: RecommendResult): ToolReply {
  return new ToolReply(recommendationsForModel(result), {
    type: 'recommendations',
    items: recommendationCards(result),
  });
}

/** get_menu for the model: the merchant and every menu with a display price. No card. */
export function menuForModel(detail: MerchantDetail) {
  return {
    merchantId: detail.merchant.id,
    store: detail.merchant.name,
    category: detail.merchant.category,
    openNow: detail.merchant.openNow,
    etaMin: detail.merchant.etaMin,
    menus: detail.menus.map((m) => ({
      menuId: m.id,
      menu: m.name,
      price: formatOkrw(parseAokrw(m.price)),
      description: m.description,
      tags: m.tags,
      available: m.available,
    })),
  };
}
