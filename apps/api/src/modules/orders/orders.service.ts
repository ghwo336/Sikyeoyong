import { Injectable } from '@nestjs/common';
import type { AppErrorCode, CreateOrderResult } from '@sikyeoyong/shared';
import { OrderApprovalEffects } from './order-approval-effects.service.js';
import {
  type ApprovalRequest,
  type ApprovalRequestOutcome,
  OrderApprovalRequests,
} from './order-approval-request.service.js';
import { OrderQuoteService, type QuoteOutcome, type QuoteRequest } from './order-quote.service.js';
import { OrderSpend } from './order-spend.service.js';

export { SPENT_STATUSES } from './order-spend.service.js';
export type { QuoteOutcome, QuoteRequest } from './order-quote.service.js';
export type { ApprovalRequest, ApprovalRequestOutcome } from './order-approval-request.service.js';

/**
 * What other modules may ask of orders (architecture.md: one exported service).
 * The work lives in the orders module's own services; this only forwards.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly spend: OrderSpend,
    private readonly quotes: OrderQuoteService,
    private readonly approvalEffects: OrderApprovalEffects,
    private readonly approvalRequests: OrderApprovalRequests,
  ) {}

  /** Personal budget spend in a KST calendar month (budget module, nag). */
  spentInMonthAokrw(userId: string, monthKst: string): bigint {
    return this.spend.spentInMonthAokrw(userId, monthKst);
  }

  /** The user's counted orders since sinceMs (recommend preference and novelty, tech-spec 3.8). */
  recentOrdersSince(
    userId: string,
    sinceMs: number,
  ): { merchantId: string; createdAtMs: number }[] {
    return this.spend.recentSince(userId, sinceMs);
  }

  /** A quote, never a payment (the place_order tool; CLAUDE.md rule 3). */
  quote(userId: string, req: QuoteRequest, nowMs?: number): Promise<QuoteOutcome> {
    return this.quotes.create(userId, req, nowMs);
  }

  /**
   * owner-approvals only: the owner approved, back to quoted (sync, inside the approvals
   * transaction). Never pays; confirm checks the rules again.
   */
  reopenApproved(orderId: string, nowMs: number): void {
    this.approvalEffects.reopen(orderId, nowMs);
  }

  /** owner-approvals only: rejected or expired, the order fails for good (sync, same transaction). */
  failUnapproved(orderId: string, code: AppErrorCode, nowMs: number): void {
    this.approvalEffects.fail(orderId, code, nowMs);
  }

  /** The order with its confirm card while quoted (sent again after an approval). */
  orderCard(userId: string, orderId: string, nowMs: number): Promise<CreateOrderResult> {
    return this.approvalEffects.card(userId, orderId, nowMs);
  }

  /** Store name and aokrw amount for an approval card. */
  approvalSummary(
    orderId: string,
    userId: string,
  ): { merchantId: string; store: string; amount: string } {
    return this.approvalEffects.summary(orderId, userId);
  }

  /** request_owner_approval: the dragon asks the owner. Never pays, never decides. */
  requestApproval(
    userId: string,
    req: ApprovalRequest,
    nowMs: number = Date.now(),
  ): Promise<ApprovalRequestOutcome> {
    return this.approvalRequests.request(userId, req, nowMs);
  }
}
