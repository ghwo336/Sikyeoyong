import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { APPROVAL_REASONS, allowedMerchants, approvals } from '../../db/schema/index.js';

export type ApprovalReason = (typeof APPROVAL_REASONS)[number];

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
