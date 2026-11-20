import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import {
  APPROVAL_REASONS,
  APPROVAL_STATUSES,
  allowedMerchants,
  approvals,
} from '../../db/schema/index.js';

export type ApprovalReason = (typeof APPROVAL_REASONS)[number];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ApprovalRow = typeof approvals.$inferSelect;

export interface NewApproval {
  readonly id: string;
  readonly userId: string;
  readonly agentId: string;
  readonly orderId: string;
  readonly reason: ApprovalReason;
  readonly payloadJson: string;
  readonly expiresAt: number;
}

/** Queries on approvals and allowed_merchants only. */
@Injectable()
export class ApprovalsRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /** Runs fn in one SQLite transaction (nested calls become savepoints). */
  inTransaction<T>(fn: () => T): T {
    return this.handle.sqlite.transaction(fn)();
  }

  insert(row: NewApproval): void {
    this.handle.db
      .insert(approvals)
      .values({ ...row, status: 'pending' })
      .run();
  }

  /** Payloads of the approved rows of this order with this reason. */
  approvedPayloads(orderId: string, reason: ApprovalReason): string[] {
    return this.handle.db
      .select({ payload: approvals.payloadJson })
      .from(approvals)
      .where(
        and(
          eq(approvals.orderId, orderId),
          eq(approvals.reason, reason),
          eq(approvals.status, 'approved'),
        ),
      )
      .all()
      .map((r) => r.payload);
  }

  findForUser(id: string, userId: string): ApprovalRow | undefined {
    return this.handle.db
      .select()
      .from(approvals)
      .where(and(eq(approvals.id, id), eq(approvals.userId, userId)))
      .get();
  }

  /** The user's pending approvals, oldest first (expired ones are filtered by the service). */
  listPending(userId: string): ApprovalRow[] {
    return this.handle.db
      .select()
      .from(approvals)
      .where(and(eq(approvals.userId, userId), eq(approvals.status, 'pending')))
      .orderBy(asc(approvals.expiresAt), asc(approvals.id))
      .all();
  }

  /** pending to a decision, one conditional UPDATE: of racing decisions exactly one wins. */
  decide(id: string, to: Exclude<ApprovalStatus, 'pending'>, nowMs: number): boolean {
    const r = this.handle.db
      .update(approvals)
      .set({ status: to, decidedAt: nowMs })
      .where(and(eq(approvals.id, id), eq(approvals.status, 'pending')))
      .run();
    return r.changes === 1;
  }

  findPendingByOrder(orderId: string): ApprovalRow | undefined {
    return this.handle.db
      .select()
      .from(approvals)
      .where(and(eq(approvals.orderId, orderId), eq(approvals.status, 'pending')))
      .get();
  }

  setPayload(id: string, payloadJson: string): void {
    this.handle.db.update(approvals).set({ payloadJson }).where(eq(approvals.id, id)).run();
  }

  /** Idempotent: a store allowed twice stays allowed once. */
  allowMerchant(userId: string, merchantId: string, nowMs: number): void {
    this.handle.db
      .insert(allowedMerchants)
      .values({ userId, merchantId, approvedAt: nowMs })
      .onConflictDoNothing()
      .run();
  }

  isMerchantAllowed(userId: string, merchantId: string): boolean {
    return (
      this.handle.db
        .select({ m: allowedMerchants.merchantId })
        .from(allowedMerchants)
        .where(
          and(eq(allowedMerchants.userId, userId), eq(allowedMerchants.merchantId, merchantId)),
        )
        .get() !== undefined
    );
  }
}
