import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { ORDER_STATUSES, orders } from '../../db/schema/index.js';

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

  findByClientOrderId(userId: string, clientOrderId: string): OrderRow | undefined {
    return this.handle.db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.clientOrderId, clientOrderId)))
      .get();
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
    set: Partial<Pick<OrderRow, 'status' | 'attempt' | 'errorCode' | 'txHash' | 'submitStartedAt'>>,
    nowMs: number,
  ): boolean {
    const r = this.handle.db
      .update(orders)
      .set({ ...set, updatedAt: nowMs })
      .where(and(eq(orders.id, id), eq(orders.status, from)))
      .run();
    return r.changes === 1;
  }

  /** Throws on a used (user, clientOrderId) or orderRef (unique indexes). */
  insert(row: NewOrder): void {
    this.handle.db
      .insert(orders)
      .values({ ...row, updatedAt: row.createdAt })
      .run();
  }
}
