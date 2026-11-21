import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Where the chain indexer stopped, one row per chain and contract (tech-spec 3.9). The last block
 * whose logs were all applied, as decimal text (block numbers are bigint). A restart resumes at
 * the block after it; the deployment block is the fallback when there is no row. Reading a block
 * twice is harmless (events are idempotent), so the row only has to be at or behind the truth.
 */
export const indexerCursors = sqliteTable(
  'indexer_cursors',
  {
    chainId: integer('chain_id').notNull(),
    contract: text('contract').notNull(),
    lastBlock: text('last_block').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.chainId, t.contract] })],
);
