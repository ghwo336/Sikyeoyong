import { Injectable } from '@nestjs/common';
import type { AppErrorCode } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { type ApprovalReason, ApprovalsRepository } from './approvals.repository.js';

/** A pending approval expires after 10 minutes (payment.md "승인 흐름과의 관계"). */
export const APPROVAL_TTL_MS = 10 * 60_000;

/** The refusals that ask the owner instead of failing the order (payment.md "실패 분류"). */
const REASON_OF: Partial<Record<AppErrorCode, ApprovalReason>> = {
  SERVER_OVER_LEVEL: 'OVER_LEVEL_LIMIT',
  CHAIN_AGENT_LIMIT: 'OVER_LEVEL_LIMIT',
  SERVER_NEW_MERCHANT: 'NEW_MERCHANT',
  SERVER_BUDGET_OVER: 'OVER_PERSONAL_BUDGET',
};

/** The approval reason for a refusal code, or null when the code does not ask the owner. */
export function approvalReasonOf(code: AppErrorCode): ApprovalReason | null {
  return REASON_OF[code] ?? null;
}

export interface OpenApprovalInput {
  readonly userId: string;
  readonly agentId: string;
  readonly orderId: string;
  readonly reason: ApprovalReason;
  /** What the approval card shows (amount as an aokrw string, never a number). */
  readonly payload?: Readonly<Record<string, string>>;
}

/**
 * Owner approvals (D-19). Other modules use approvals only through this service.
 * The orders module depends on it, never the other way.
 */
@Injectable()
export class ApprovalsService {
  constructor(private readonly repo: ApprovalsRepository) {}

  /**
   * The one way an order reaches pending_approval: writeOrder (insert the order,
   * or move it to pending_approval) and the pending approval row commit in one
   * transaction, so no order waits without its approval. If writeOrder throws,
   * nothing is written. place_order, request_owner_approval and confirm all use it.
   */
  openWithOrder(
    input: OpenApprovalInput,
    writeOrder: () => void,
    nowMs: number = Date.now(),
  ): { approvalId: string; expiresAt: number } {
    const approvalId = uuidv7(nowMs);
    const expiresAt = nowMs + APPROVAL_TTL_MS;
    this.repo.inTransaction(() => {
      writeOrder();
      this.repo.insert({
        id: approvalId,
        userId: input.userId,
        agentId: input.agentId,
        orderId: input.orderId,
        reason: input.reason,
        payloadJson: JSON.stringify(input.payload ?? {}),
        expiresAt,
      });
    });
    return { approvalId, expiresAt };
  }

  /** Whether the owner has allowed this store (D-07 "처음 보는 가게", server only). */
  isMerchantAllowed(userId: string, merchantId: string): boolean {
    return this.repo.isMerchantAllowed(userId, merchantId);
  }
}
