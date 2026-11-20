import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { agents } from './agents.js';
import { aokrwCheck, enumCheck } from './checks.js';
import { merchants } from './merchants.js';
import { users } from './users.js';

/** payment.md "confirm 상태 규칙" (D-19) is the source of these states. */
export const ORDER_STATUSES = [
  'quoted',
  'pending_approval',
  'submitting',
  'paid',
  'preparing',
  'delivering',
  'delivered',
  'failed',
  'cancelled',
  'refunded',
] as const;

/** Orders are never deleted; state says what happened (data.md). */
export const orders = sqliteTable(
  'orders',
  {
    id: text('id').primaryKey(),
    /** bytes32 hex, the idempotency key on chain (OrderExists). */
    orderRef: text('order_ref').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id),
    amountAokrw: text('amount').notNull(),
    itemsJson: text('items_json').notNull(),
    note: text('note'),
    status: text('status', { enum: ORDER_STATUSES }).notNull(),
    txHash: text('tx_hash'),
    errorCode: text('error_code'),
    receiptJson: text('receipt_json'),
    /** How many times a person started paying, from 0 (D-19). */
    attempt: integer('attempt').notNull().default(0),
    /** Submit-start marker, committed before broadcast (payment.md, D-19). */
    submitStartedAt: integer('submit_started_at'),
    submitTxHash: text('submit_tx_hash'),
    submitNonce: integer('submit_nonce'),
    mawsRequestId: text('maws_request_id'),
    /** POST /orders idempotency key from the app (server-api.md "멱등성"); null for place_order. */
    clientOrderId: text('client_order_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('orders_user_created_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status),
    uniqueIndex('orders_user_client_order_uq').on(t.userId, t.clientOrderId),
    aokrwCheck('orders_amount_check', t.amountAokrw),
    enumCheck('orders_status_check', t.status, ORDER_STATUSES),
  ],
);

export const ORDER_EVENT_SOURCES = ['server', 'chain'] as const;

/** Chain events are idempotent on (tx_hash, log_index) (data.md). */
export const orderEvents = sqliteTable(
  'order_events',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    type: text('type').notNull(),
    payloadJson: text('payload_json').notNull().default('{}'),
    source: text('source', { enum: ORDER_EVENT_SOURCES }).notNull(),
    txHash: text('tx_hash'),
    logIndex: integer('log_index'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('order_events_tx_log_uq').on(t.txHash, t.logIndex),
    index('order_events_order_idx').on(t.orderId),
    enumCheck('order_events_source_check', t.source, ORDER_EVENT_SOURCES),
  ],
);

export const APPROVAL_REASONS = [
  'OVER_LEVEL_LIMIT',
  'NEW_MERCHANT',
  'OVER_PERSONAL_BUDGET',
] as const;
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;

/** Tied to one order; at most one pending approval per order (D-19). */
export const approvals = sqliteTable(
  'approvals',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    reason: text('reason', { enum: APPROVAL_REASONS }).notNull(),
    payloadJson: text('payload_json').notNull().default('{}'),
    status: text('status', { enum: APPROVAL_STATUSES }).notNull().default('pending'),
    expiresAt: integer('expires_at').notNull(),
    decidedAt: integer('decided_at'),
  },
  (t) => [
    index('approvals_user_status_idx').on(t.userId, t.status),
    uniqueIndex('approvals_pending_order_uq')
      .on(t.orderId)
      .where(sql`${t.status} = 'pending'`),
    enumCheck('approvals_reason_check', t.reason, APPROVAL_REASONS),
    enumCheck('approvals_status_check', t.status, APPROVAL_STATUSES),
  ],
);

/** Stores the owner has said yes to (server side; MAWS allowedTargets stays fixed, D-13). */
export const allowedMerchants = sqliteTable(
  'allowed_merchants',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id),
    approvedAt: integer('approved_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.merchantId] })],
);
