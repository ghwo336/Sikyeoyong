import { Injectable } from '@nestjs/common';
import {
  AppError,
  type AppErrorCode,
  type ApprovalDecision,
  type ApprovalList,
} from '@sikyeoyong/shared';
import {
  type ApprovalReason,
  type ApprovalRow,
  ApprovalsService,
} from '../approvals/approvals.service.js';
import { OrdersService } from '../orders/orders.service.js';

/** The refusal an unapproved order keeps as its error_code (payment.md "승인 흐름과의 관계"). */
const CODE_OF: Record<ApprovalReason, AppErrorCode> = {
  OVER_LEVEL_LIMIT: 'SERVER_OVER_LEVEL',
  NEW_MERCHANT: 'SERVER_NEW_MERCHANT',
  OVER_PERSONAL_BUDGET: 'SERVER_BUDGET_OVER',
};

/**
 * The owner's yes or no on an order (tech-spec 1.4 flow 3, D-19). Each decision
 * and its effect on the order commit in one transaction; approving never pays,
 * it puts the order back to quoted and returns its confirm card. This module
 * joins approvals and orders so that neither depends on the other's direction.
 */
@Injectable()
export class OwnerApprovalsService {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly orders: OrdersService,
  ) {}

  /** GET /approvals?status=pending. Approvals past their 10 minutes are expired on the way. */
  list(userId: string, nowMs: number = Date.now()): ApprovalList {
    this.expireDue(userId, nowMs);
    return {
      approvals: this.approvals.listPending(userId).map((a) => {
        const s = this.orders.approvalSummary(a.orderId, userId);
        return {
          id: a.id,
          orderId: a.orderId,
          reason: a.reason,
          store: s.store,
          amount: s.amount,
          expiresAt: a.expiresAt,
        };
      }),
    };
  }

  /**
   * Yes: a new store is remembered (allowed_merchants), a budget overrun is allowed
   * for this order's amount (the approved row itself), and the order is quoted again.
   * A level raise is not done here: it changes the chain TransferLimit and goes through
   * POST /agents/me/level with this approval (tech-spec 3.2).
   */
  async approve(userId: string, id: string, nowMs: number = Date.now()): Promise<ApprovalDecision> {
    const a = this.pendingOrAnswer(userId, id, nowMs);
    if ('answer' in a) return a.answer;
    if (a.row.reason === 'OVER_LEVEL_LIMIT') {
      throw new AppError('VALIDATION_FAILED', {
        public: {
          issues: [{ path: 'id', message: 'raise the level with POST /agents/me/level' }],
        },
      });
    }
    const merchantId = this.orders.approvalSummary(a.row.orderId, userId).merchantId;
    this.approvals.decide(
      a.row,
      'approved',
      () => {
        this.orders.reopenApproved(a.row.orderId, nowMs);
      },
      nowMs,
      a.row.reason === 'NEW_MERCHANT' ? { allowMerchant: merchantId } : {},
    );
    return this.answer(userId, id, nowMs);
  }

  /** No: the order fails for good with the reason's code. */
  async reject(userId: string, id: string, nowMs: number = Date.now()): Promise<ApprovalDecision> {
    const a = this.pendingOrAnswer(userId, id, nowMs);
    if ('answer' in a) return a.answer;
    this.close(a.row, 'rejected', nowMs);
    return this.answer(userId, id, nowMs);
  }

  /** The approval if it is still pending; otherwise (decided, or just expired) the answer as it is. */
  private pendingOrAnswer(
    userId: string,
    id: string,
    nowMs: number,
  ): { row: ApprovalRow } | { answer: Promise<ApprovalDecision> } {
    const row = this.approvals.findForUser(id, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'approval not found' });
    if (row.status === 'pending' && row.expiresAt <= nowMs) this.close(row, 'expired', nowMs);
    if (row.status !== 'pending' || row.expiresAt <= nowMs) {
      return { answer: this.answer(userId, id, nowMs) };
    }
    return { row };
  }

  private close(row: ApprovalRow, to: 'rejected' | 'expired', nowMs: number): void {
    this.approvals.decide(
      row,
      to,
      () => {
        this.orders.failUnapproved(row.orderId, CODE_OF[row.reason], nowMs);
      },
      nowMs,
    );
  }

  private expireDue(userId: string, nowMs: number): void {
    for (const row of this.approvals.listPending(userId)) {
      if (row.expiresAt <= nowMs) this.close(row, 'expired', nowMs);
    }
  }

  private async answer(userId: string, id: string, nowMs: number): Promise<ApprovalDecision> {
    const row = this.approvals.findForUser(id, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'approval not found' });
    const card = await this.orders.orderCard(userId, row.orderId, nowMs);
    return {
      approval: { id: row.id, status: row.status },
      order: card.order,
      ...(card.quote === undefined ? {} : { quote: card.quote }),
    };
  }
}
