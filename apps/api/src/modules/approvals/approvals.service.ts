import { Injectable } from '@nestjs/common';
import { AppError, type AppErrorCode } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import {
  type ApprovalReason,
  type ApprovalRow,
  ApprovalsRepository,
} from './approvals.repository.js';

export type { ApprovalReason, ApprovalRow } from './approvals.repository.js';

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
    writeOrder: () => unknown,
    nowMs: number = Date.now(),
  ): { approvalId: string; expiresAt: number } {
    const approvalId = uuidv7(nowMs);
    const expiresAt = nowMs + APPROVAL_TTL_MS;
    this.repo.inTransaction(() => {
      const written = writeOrder();
      // An async writeOrder would run its writes after the transaction ends.
      if (written instanceof Promise) {
        throw new AppError('INTERNAL', { reason: 'writeOrder must be synchronous' });
      }
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

  /**
   * Whether the owner approved going over the budget for exactly this amount on
   * this order. A different amount (the price changed, a new quote) does not count
   * (payment.md "승인된 사유는 그 주문의 confirm에서 다시 막지 않는다").
   */
  budgetApprovedFor(orderId: string, amountAokrw: string): boolean {
    return this.repo.approvedPayloads(orderId, 'OVER_PERSONAL_BUDGET').some((json) => {
      try {
        return (JSON.parse(json) as { amount?: unknown }).amount === amountAokrw;
      } catch {
        return false;
      }
    });
  }

  findForUser(id: string, userId: string): ApprovalRow | undefined {
    return this.repo.findForUser(id, userId);
  }

  /** Every pending row of the user, oldest first; the caller expires those past expires_at. */
  listPending(userId: string): ApprovalRow[] {
    return this.repo.listPending(userId);
  }

  /**
   * The owner's decision (or the clock's: expired) and its effect on the order in one
   * transaction. Returns false, writing nothing, when the approval was no longer
   * pending (another decision won). If effect throws, nothing is written.
   * allowMerchant: also remember the store (NEW_MERCHANT, D-07).
   */
  decide(
    approval: ApprovalRow,
    to: 'approved' | 'rejected' | 'expired',
    effect: () => unknown,
    nowMs: number,
    opts: { allowMerchant?: string } = {},
  ): boolean {
    return this.repo.inTransaction(() => {
      if (!this.repo.decide(approval.id, to, nowMs)) return false;
      if (opts.allowMerchant !== undefined) {
        this.repo.allowMerchant(approval.userId, opts.allowMerchant, nowMs);
      }
      const done = effect();
      if (done instanceof Promise) {
        throw new AppError('INTERNAL', { reason: 'effect must be synchronous' });
      }
      return true;
    });
  }

  /**
   * request_owner_approval (tech-spec 1.4 flow 3): the dragon's words to the owner,
   * kept on the order's live approval card (at most 200 characters, shown as text only).
   * Returns the approval's reason, or null when the order has no live pending approval.
   */
  attachMessage(
    orderId: string,
    message: string | undefined,
    nowMs: number,
  ): ApprovalReason | null {
    const row = this.repo.findPendingByOrder(orderId);
    if (row === undefined || row.expiresAt <= nowMs) return null;
    if (message !== undefined) {
      const payload = parsePayload(row.payloadJson);
      this.repo.setPayload(row.id, JSON.stringify({ ...payload, message: message.slice(0, 200) }));
    }
    return row.reason;
  }

  /** Whether the owner has allowed this store (D-07 "처음 보는 가게", server only). */
  isMerchantAllowed(userId: string, merchantId: string): boolean {
    return this.repo.isMerchantAllowed(userId, merchantId);
  }
}

function parsePayload(json: string): Record<string, string> {
  try {
    const v: unknown = JSON.parse(json);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
    return Object.fromEntries(
      Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string'),
    );
  } catch {
    return {};
  }
}
