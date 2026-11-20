import { Injectable, Logger } from '@nestjs/common';
import { parseAokrw } from '@sikyeoyong/shared';
import { z } from 'zod';
import type { MenuRecord, MerchantRecord, MerchantSource } from './merchant-source.js';
import { type MenuRow, type MerchantRow, MerchantsRepository } from './merchants.repository.js';

/**
 * Arrival time of a phase 1 mock merchant: the server delivery timer runs
 * 30 + 60 + 90 seconds by default (merchants.md DELIVERY_TIMELINE_SECONDS),
 * so an order arrives in 3 minutes. Not a real kitchen's time; the delivery
 * module should own this number when it lands.
 */
export const MOCK_ETA_MIN = 3;

const zTags = z.array(z.string());
const zOpenHours = z.record(z.string(), z.string());

/**
 * MerchantSource over the merchants and menus tables (tech-spec 3.5): the
 * seeded mock merchants now, console-registered ones in phase 2. A stored JSON
 * column that does not parse is logged and read as empty (no tags, never open),
 * so a broken row is hidden from ordering rather than guessed.
 */
@Injectable()
export class DbMerchantSource implements MerchantSource {
  private readonly logger = new Logger(DbMerchantSource.name);

  constructor(private readonly repo: MerchantsRepository) {}

  list(filter: { readonly category?: string }): MerchantRecord[] {
    return this.repo.list(filter.category).map((r) => this.merchant(r));
  }

  get(id: string): MerchantRecord | null {
    const row = this.repo.find(id);
    return row === undefined ? null : this.merchant(row);
  }

  menus(merchantId: string): MenuRecord[] {
    return this.repo.menusOf(merchantId).map((r) => this.menu(r));
  }

  private merchant(r: MerchantRow): MerchantRecord {
    return {
      id: r.id,
      onchainId: r.onchainId,
      name: r.name,
      category: r.category,
      tags: this.json(zTags, r.tagsJson, [], `merchant ${r.id} tags`),
      verified: r.verified,
      active: r.active,
      openHours: this.json(zOpenHours, r.openHoursJson, {}, `merchant ${r.id} open hours`),
      etaMin: MOCK_ETA_MIN,
    };
  }

  private menu(r: MenuRow): MenuRecord {
    return {
      id: r.id,
      merchantId: r.merchantId,
      name: r.name,
      priceAokrw: parseAokrw(r.priceAokrw),
      tags: this.json(zTags, r.tagsJson, [], `menu ${r.id} tags`),
      description: r.description,
      available: r.available,
    };
  }

  private json<T>(schema: z.ZodType<T>, text: string, fallback: T, what: string): T {
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to the log below
    }
    this.logger.warn(`unreadable stored ${what}`);
    return fallback;
  }
}
