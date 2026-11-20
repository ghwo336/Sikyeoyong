import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { menus, merchants } from '../../db/schema/index.js';

export type MerchantRow = typeof merchants.$inferSelect;
export type MenuRow = typeof menus.$inferSelect;

/** Queries on merchants and menus only (architecture.md: repositories hold no rules). */
@Injectable()
export class MerchantsRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /** Every merchant, optionally of one category, in id order (UUID v7, so insert order). */
  list(category?: string): MerchantRow[] {
    const q = this.handle.db.select().from(merchants);
    return (category === undefined ? q : q.where(eq(merchants.category, category)))
      .orderBy(asc(merchants.id))
      .all();
  }

  find(id: string): MerchantRow | undefined {
    return this.handle.db.select().from(merchants).where(eq(merchants.id, id)).get();
  }

  menusOf(merchantId: string): MenuRow[] {
    return this.handle.db
      .select()
      .from(menus)
      .where(eq(menus.merchantId, merchantId))
      .orderBy(asc(menus.id))
      .all();
  }
}
