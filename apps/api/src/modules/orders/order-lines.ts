import { AppError, aokrwToString, parseAokrw, type OrderItemLine } from '@sikyeoyong/shared';
import type { MenuItem } from '../merchants/merchants.service.js';

/** One stored line (orders.items_json): menuId keeps the order re-priceable at confirm (D-19). */
export interface StoredLine {
  readonly menuId: string;
  readonly name: string;
  readonly quantity: number;
  /** menus.price * quantity at quote time, aokrw string. */
  readonly price: string;
}

export interface RequestedItem {
  readonly menuId: string;
  readonly qty: number;
}

/**
 * Prices the requested items from the server menus (never the client or the LLM).
 * A menu that is missing or sold out is NOT_FOUND; the same menu twice is a 400.
 */
export function priceLines(
  items: readonly RequestedItem[],
  menus: ReadonlyMap<string, MenuItem>,
): { lines: StoredLine[]; total: bigint } {
  const seen = new Set<string>();
  const lines: StoredLine[] = [];
  let total = 0n;
  for (const item of items) {
    if (seen.has(item.menuId)) {
      throw new AppError('VALIDATION_FAILED', {
        public: { issues: [{ path: 'items', message: 'the same menu twice' }] },
      });
    }
    seen.add(item.menuId);
    const menu = menus.get(item.menuId);
    if (menu === undefined || !menu.available) {
      throw new AppError('NOT_FOUND', { reason: 'menu not found or sold out' });
    }
    const price = menu.priceAokrw * BigInt(item.qty);
    total += price;
    lines.push({
      menuId: menu.id,
      name: menu.name,
      quantity: item.qty,
      price: aokrwToString(price),
    });
  }
  return { lines, total };
}

/** The lines as the confirm card shows them. */
export function toItemLines(lines: readonly StoredLine[]): OrderItemLine[] {
  return lines.map((l) => ({ name: l.name, quantity: l.quantity, price: l.price }));
}

/** Same merchant and the same menus and quantities, in any order (idempotent resend). */
export function sameRequest(
  a: { merchantId: string; items: readonly RequestedItem[] },
  b: { merchantId: string; items: readonly RequestedItem[] },
): boolean {
  const key = (items: readonly RequestedItem[]) =>
    items
      .map((i) => `${i.menuId}\u0000${String(i.qty)}`)
      .sort()
      .join('\u0001');
  return a.merchantId === b.merchantId && key(a.items) === key(b.items);
}

export function parseStoredLines(json: string): StoredLine[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed))
    throw new AppError('INTERNAL', { reason: 'items_json is not a list' });
  return parsed.map((x: unknown) => {
    const l = x as Partial<StoredLine>;
    if (
      typeof l.menuId !== 'string' ||
      typeof l.name !== 'string' ||
      typeof l.quantity !== 'number' ||
      typeof l.price !== 'string'
    ) {
      throw new AppError('INTERNAL', { reason: 'items_json line is malformed' });
    }
    parseAokrw(l.price);
    return { menuId: l.menuId, name: l.name, quantity: l.quantity, price: l.price };
  });
}
