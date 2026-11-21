import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { aokrwCheck, enumCheck } from './checks.js';
import { users } from './users.js';

/**
 * Owner allowance moves (wallet screen "주인님 용돈", D-24 custodial). While the operator owns
 * every agent, the owner's money sits with the operator; this ledger says how much of it is
 * this user's. trial: the one sign-up allowance (in); fund: owner to the dragon's pocket (out);
 * refund: the pocket back to the owner (in). With OWNER_MODE=pouch the owner wallet is the
 * user's own and its chain balance replaces this ledger.
 */
export const ALLOWANCE_KINDS = ['trial', 'fund', 'refund'] as const;

export const ownerAllowanceEntries = sqliteTable(
  'owner_allowance_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind', { enum: ALLOWANCE_KINDS }).notNull(),
    /** aokrw, always positive; the kind gives the sign. */
    amountAokrw: text('amount_aokrw').notNull(),
    txHash: text('tx_hash'),
    /**
     * fund holds only: the order the top-up is for, and when the fund call was about to start
     * (set after the order's marker, before the call). A hold with an order and no start time
     * never reached the call, which is the only thing reconciliation may release. Null on rows
     * from before migration 0016.
     */
    orderId: text('order_id'),
    fundCallStartedAt: integer('fund_call_started_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('owner_allowance_user_idx').on(t.userId),
    // One sign-up allowance per user.
    uniqueIndex('owner_allowance_trial_uq')
      .on(t.userId)
      .where(sql`${t.kind} = 'trial'`),
    enumCheck('owner_allowance_kind_check', t.kind, ALLOWANCE_KINDS),
    aokrwCheck('owner_allowance_amount_check', t.amountAokrw),
    // verify-allow: R4 drizzle sql template with a column reference, not a display string
    check('owner_allowance_amount_positive', sql`${t.amountAokrw} <> '0'`),
  ],
);
