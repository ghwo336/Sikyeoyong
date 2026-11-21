import { Injectable } from '@nestjs/common';
import { AppError, type AppErrorCode } from '@sikyeoyong/shared';
import { ApprovalsService, approvalReasonOf } from '../approvals/approvals.service.js';
import { classify } from './failure-class.js';
import { type OrderRow, OrdersRepository } from './orders.repository.js';

/**
 * Moves an order out of `submitting` by the class of a refusal (payment.md "실패 분류", D-19).
 * The live confirm path and the boot recheck both end a refused order here, so an approval-class
 * refusal always becomes pending_approval with its approval row, never a dead-end failed.
 */
@Injectable()
export class OrderSettler {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly approvals: ApprovalsService,
  ) {}

  /**
   * `marked` is whether the submit-start marker was committed. Returns whether the order left
   * submitting (false: an unknown result after the marker, a person looks, D-19).
   */
  settle(
    userId: string,
    row: OrderRow,
    code: AppErrorCode,
    marked: boolean,
    nowMs: number,
    attempt?: number,
  ): boolean {
    const cls = classify(code, !marked);
    if (cls === 'approval') {
      this.toApproval(userId, row, code, nowMs, attempt);
      return true;
    }
    if (cls === 'retryable' || cls === 'final') {
      return this.repo.transition(
        row.id,
        'submitting',
        { status: 'failed', errorCode: code },
        nowMs,
        { attempt },
      );
    }
    if (!marked) {
      // Nothing went out before the marker, so nothing can have been paid.
      return this.repo.transition(
        row.id,
        'submitting',
        { status: 'failed', errorCode: 'INTERNAL' },
        nowMs,
        { attempt },
      );
    }
    return false;
  }

  /** submitting to pending_approval with its approval row, in one transaction (D-19). */
  toApproval(
    userId: string,
    row: OrderRow,
    code: AppErrorCode,
    nowMs: number,
    attempt?: number,
  ): void {
    const reason = approvalReasonOf(code);
    if (reason === null) throw new AppError('INTERNAL', { reason: 'not an approval code' });
    this.approvals.openWithOrder(
      {
        userId,
        agentId: row.agentId,
        orderId: row.id,
        reason,
        payload: { merchantId: row.merchantId, amount: row.amountAokrw },
      },
      () => {
        const moved = this.repo.transition(
          row.id,
          'submitting',
          { status: 'pending_approval' },
          nowMs,
          { attempt },
        );
        if (!moved) throw new AppError('INTERNAL', { reason: 'order left submitting' });
      },
      nowMs,
    );
  }
}
