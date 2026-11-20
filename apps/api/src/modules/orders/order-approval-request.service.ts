import { Injectable } from '@nestjs/common';
import { AppError, type CreateOrderResult } from '@sikyeoyong/shared';
import { type ApprovalReason, ApprovalsService } from '../approvals/approvals.service.js';
import { parseStoredLines, type RequestedItem, sameRequest } from './order-lines.js';
import { OrderQuoteService } from './order-quote.service.js';
import { OrdersRepository } from './orders.repository.js';

export interface ApprovalRequest {
  readonly merchantId?: string;
  readonly items?: readonly RequestedItem[];
  readonly message?: string;
}

/** What request_owner_approval did. The reason is always the server's, never the model's. */
export type ApprovalRequestOutcome =
  | { readonly kind: 'requested'; readonly orderId: string; readonly reason: ApprovalReason }
  | { readonly kind: 'quoted'; readonly result: CreateOrderResult };

/**
 * request_owner_approval (tech-spec 1.4 flow 3 step 2): put the dragon's message on
 * the user's live approval for the same store and items (the newest if several);
 * with no store given, on the newest live one. With none, make the order the
 * place_order way: the server's rules decide whether the owner is asked at all.
 */
@Injectable()
export class OrderApprovalRequests {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly quotes: OrderQuoteService,
    private readonly approvals: ApprovalsService,
  ) {}

  async request(
    userId: string,
    req: ApprovalRequest,
    nowMs: number,
  ): Promise<ApprovalRequestOutcome> {
    const items = req.items ?? [];
    const candidates = this.repo.pendingApproval(userId, req.merchantId).filter(
      (o) =>
        req.merchantId === undefined ||
        items.length === 0 ||
        sameRequest(
          {
            merchantId: o.merchantId,
            items: parseStoredLines(o.itemsJson).map((l) => ({
              menuId: l.menuId,
              qty: l.quantity,
            })),
          },
          { merchantId: req.merchantId, items },
        ),
    );
    for (const order of candidates) {
      const reason = this.approvals.attachMessage(order.id, req.message, nowMs);
      if (reason !== null) return { kind: 'requested', orderId: order.id, reason };
    }
    if (req.merchantId === undefined || items.length === 0) {
      throw new AppError('NOT_FOUND', { reason: 'no order waiting for the owner' });
    }
    const outcome = await this.quotes.create(
      userId,
      { merchantId: req.merchantId, items, clientOrderId: null },
      nowMs,
    );
    if (outcome.approvalReason === null) return { kind: 'quoted', result: outcome.result };
    this.approvals.attachMessage(outcome.result.order.id, req.message, nowMs);
    return { kind: 'requested', orderId: outcome.result.order.id, reason: outcome.approvalReason };
  }
}
