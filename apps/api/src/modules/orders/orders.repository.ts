import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { TasteRating } from '@sikyeoyong/shared';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { ORDER_STATUSES, orderEvents, orderRatings, orders } from '../../db/schema/index.js';

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderRow = typeof orders.$inferSelect;

export interface NewOrder {
  readonly id: string;
  readonly orderRef: string;
  readonly userId: string;
  readonly agentId: string;
  readonly merchantId: string;
  readonly amountAokrw: string;
  readonly itemsJson: string;
  readonly status: 'quoted' | 'pending_approval';
  readonly clientOrderId: string | null;
  readonly note: string | null;
  readonly createdAt: number;
}

/** Queries on orders only. */
@Injectable()
export class OrdersRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /** Amount strings of the user's orders in [startMs, endMs) with one of the statuses. */
  amountsBetween(
    userId: string,
    statuses: readonly OrderStatus[],
    startMs: number,
    endMs: number,
  ): string[] {
    return this.handle.db
      .select({ amount: orders.amountAokrw })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          inArray(orders.status, [...statuses]),
          gte(orders.createdAt, startMs),
          lt(orders.createdAt, endMs),
        ),
      )
      .all()
      .map((r) => r.amount);
  }

  /** The user's orders in the statuses created at or after sinceMs, oldest first. */
  merchantsSince(
    userId: string,
    statuses: readonly OrderStatus[],
    sinceMs: number,
  ): { merchantId: string; createdAtMs: number }[] {
    return this.handle.db
      .select({ merchantId: orders.merchantId, createdAtMs: orders.createdAt })
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          inArray(orders.status, [...statuses]),
          gte(orders.createdAt, sinceMs),
        ),
      )
      .orderBy(asc(orders.createdAt), asc(orders.id))
      .all();
  }

  /** Whether the user has an order at this merchant in one of the statuses. */
  hasOrderAt(userId: string, merchantId: string, statuses: readonly OrderStatus[]): boolean {
    return (
      this.handle.db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.userId, userId),
            eq(orders.merchantId, merchantId),
            inArray(orders.status, [...statuses]),
          ),
        )
        .get() !== undefined
    );
  }

  /** The user's orders waiting for approval, newest first (optionally at one store). */
  pendingApproval(userId: string, merchantId?: string): OrderRow[] {
    return this.handle.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, userId),
          eq(orders.status, 'pending_approval'),
          ...(merchantId === undefined ? [] : [eq(orders.merchantId, merchantId)]),
        ),
      )
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .all();
  }

  /** The user's orders not in the left-out statuses, newest first, at most `max`. */
  recentForUser(userId: string, leaveOut: readonly OrderStatus[], max: number): OrderRow[] {
    return this.handle.db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), notInArray(orders.status, [...leaveOut])))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(max)
      .all();
  }

  findByClientOrderId(userId: string, clientOrderId: string): OrderRow | undefined {
    return this.handle.db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.clientOrderId, clientOrderId)))
      .get();
  }

  /** Every order in the status, oldest first (the boot recheck of `submitting`). */
  withStatus(status: OrderStatus): OrderRow[] {
    return this.handle.db
      .select()
      .from(orders)
      .where(eq(orders.status, status))
      .orderBy(asc(orders.createdAt), asc(orders.id))
      .all();
  }

  findByOrderRef(orderRef: string): OrderRow | undefined {
    return this.handle.db
      .select()
      .from(orders)
      .where(eq(orders.orderRef, orderRef.toLowerCase()))
      .get();
  }

  /**
   * One chain event of an order, idempotent on (tx_hash, log_index) (data.md). Returns whether
   * it was new.
   */
  recordChainEvent(
    orderId: string,
    type: string,
    txHash: string,
    logIndex: number,
    payload: object,
    nowMs: number,
  ): boolean {
    const r = this.handle.db
      .insert(orderEvents)
      .values({
        id: `${txHash}:${String(logIndex)}`,
        orderId,
        type,
        payloadJson: JSON.stringify(payload),
        source: 'chain',
        txHash,
        logIndex,
        createdAt: nowMs,
      })
      .onConflictDoNothing()
      .run();
    return r.changes === 1;
  }

  findForUser(id: string, userId: string): OrderRow | undefined {
    return this.handle.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.userId, userId)))
      .get();
  }

  /**
   * The one way an order changes state: a conditional UPDATE on (id, status), so of
   * requests racing on the same order exactly one wins (payment.md "confirm 상태 규칙").
   * Returns whether this call won.
   */
  transition(
    id: string,
    from: OrderStatus,
    set: Partial<
      Pick<
        OrderRow,
        'status' | 'errorCode' | 'txHash' | 'submitStartedAt' | 'submitTxHash' | 'submitNonce'
      >
    >,
    nowMs: number,
    opts: { bumpAttempt?: boolean } = {},
  ): boolean {
    const r = this.handle.db
      .update(orders)
      .set({
        ...set,
        // A person started paying: counted in SQL, never from a value read earlier.
        ...(opts.bumpAttempt === true ? { attempt: sql`${orders.attempt} + 1` } : {}),
        updatedAt: nowMs,
      })
      .where(and(eq(orders.id, id), eq(orders.status, from)))
      .run();
    return r.changes === 1;
  }

  /**
   * The top-up marker (payment.md "즉시 충전(fund)의 멱등성"): set before the fund call. Refused
   * (false) while an earlier top-up of this order has a marker and no hash, in one conditional
   * UPDATE so two requests cannot both fund.
   */
  markFundStart(id: string, amountAokrw: string, nowMs: number): boolean {
    const r = this.handle.db
      .update(orders)
      .set({
        fundStartedAt: nowMs,
        fundTxHash: null,
        fundAmountAokrw: amountAokrw,
        updatedAt: nowMs,
      })
      .where(and(eq(orders.id, id), or(isNull(orders.fundStartedAt), isNotNull(orders.fundTxHash))))
      .run();
    return r.changes === 1;
  }

  /** The fund call returned: its hash settles the marker. */
  recordFundTx(id: string, txHash: string, nowMs: number): void {
    this.handle.db
      .update(orders)
      .set({ fundTxHash: txHash, updatedAt: nowMs })
      .where(eq(orders.id, id))
      .run();
  }

  /** Nothing was sent (the owner has not signed): take the marker back. */
  clearFundStart(id: string, nowMs: number): void {
    this.handle.db
      .update(orders)
      .set({ fundStartedAt: null, fundTxHash: null, fundAmountAokrw: null, updatedAt: nowMs })
      .where(eq(orders.id, id))
      .run();
  }

  /** The taste rating for one order: insert, or replace the earlier one. */
  rate(orderId: string, userId: string, value: TasteRating, nowMs: number): void {
    this.handle.db
      .insert(orderRatings)
      .values({ orderId, userId, value, ratedAt: nowMs })
      .onConflictDoUpdate({ target: orderRatings.orderId, set: { value, ratedAt: nowMs } })
      .run();
  }

  /** Throws on a used (user, clientOrderId) or orderRef (unique indexes). */
  insert(row: NewOrder): void {
    this.handle.db
      .insert(orders)
      .values({ ...row, updatedAt: row.createdAt })
      .run();
  }
}
