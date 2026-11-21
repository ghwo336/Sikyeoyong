import type { OrderQuote, OrderView, RecommendationCard } from '../../lib/api';

/**
 * A tap on a recommendation whose order already exists must not start a second one (QA 6 H1:
 * a new approval each time). The web tells by what the owner sees: the same store, menu and
 * price. The server has no key for it (every POST /orders is a new order).
 */
const sameLine = (
  rec: RecommendationCard,
  store: string,
  items: readonly { readonly name: string; readonly price: string; readonly quantity: number }[],
) =>
  store === rec.store &&
  items.length === 1 &&
  items[0]?.name === rec.menu &&
  items[0].price === rec.price &&
  items[0].quantity === 1;

/** The order of this pick that waits for the owner's yes, if any (its card is in the chat). */
export function waitingFor(
  rec: RecommendationCard,
  orders: readonly OrderView[] | undefined,
): OrderView | undefined {
  return (orders ?? []).find(
    (o) => o.status === 'pending_approval' && sameLine(rec, o.store, o.items),
  );
}

/**
 * The confirm card already made for this pick (the owner said yes and closed the sheet without
 * paying). Gone once that order shows in the list: quoted orders are left out of it, so being
 * listed means it was confirmed.
 */
export function openQuoteFor(
  rec: RecommendationCard,
  quote: OrderQuote | undefined,
  orders: readonly OrderView[] | undefined,
): OrderQuote | undefined {
  if (!quote || !sameLine(rec, quote.store, quote.items)) return undefined;
  return (orders ?? []).some((o) => o.id === quote.orderId) ? undefined : quote;
}
