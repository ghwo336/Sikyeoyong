import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// tech-spec 4. Money is aokrw as a decimal text (data.md), time is unix ms.
export const merchants = sqliteTable(
  'merchants',
  {
    id: text('id').primaryKey(),
    onchainId: text('onchain_id').unique(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    tagsJson: text('tags_json').notNull().default('[]'),
    payoutAddress: text('payout_address').notNull().unique(),
    kybUid: text('kyb_uid'),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    businessNoHash: text('business_no_hash'),
    metadataUri: text('metadata_uri'),
    openHoursJson: text('open_hours_json').notNull().default('{}'),
    source: text('source', { enum: ['seed', 'console'] }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [check('merchants_source_check', sql`${t.source} in ('seed', 'console')`)],
);

export const menus = sqliteTable(
  'menus',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id),
    name: text('name').notNull(),
    priceAokrw: text('price').notNull(),
    tagsJson: text('tags_json').notNull().default('[]'),
    description: text('description').notNull().default(''),
    available: integer('available', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    index('menus_merchant_id_idx').on(t.merchantId),
    // aokrw decimal integer text only: digits, no leading zero, uint256 length at most (data.md).
    check(
      'menus_price_check',
      // verify-allow: R4 drizzle sql template with a column reference, not a display string
      sql`${t.priceAokrw} <> '' and ${t.priceAokrw} not glob '*[^0-9]*' and (${t.priceAokrw} = '0' or ${t.priceAokrw} not like '0%') and length(${t.priceAokrw}) <= 78`,
    ),
  ],
);
