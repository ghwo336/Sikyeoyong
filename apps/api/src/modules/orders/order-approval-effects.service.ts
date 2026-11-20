import { Injectable } from '@nestjs/common';
import { AppError, type AppErrorCode, type CreateOrderResult } from '@sikyeoyong/shared';
import { MerchantsService } from '../merchants/merchants.service.js';
import { OrderQuoteService } from './order-quote.service.js';
import { OrdersRepository } from './orders.repository.js';

/**
 * What an owner's decision does to its order (payment.md "승인 흐름과의 관계", D-19).
 * The sync moves run inside the approvals transaction; none of them pays.
 */
@Injectable()
export class OrderApprovalEffects {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly quotes: OrderQuoteService,
    private readonly merchants: MerchantsService,
  ) {}

  /** Approved: pending_approval back to quoted, so its card can be pressed again. Throws if it moved. */
  reopen(orderId: string, nowMs: number): void {
    if (!this.repo.transition(orderId, 'pending_approval', { status: 'quoted' }, nowMs)) {
      throw new AppError('INTERNAL', { reason: 'order is not waiting for approval' });
    }
  }

  /** Rejected or expired: the order fails for good with the reason's code. Throws if it moved. */
  fail(orderId: string, code: AppErrorCode, nowMs: number): void {
    const moved = this.repo.transition(
      orderId,
      'pending_approval',
      { status: 'failed', errorCode: code },
      nowMs,
    );
    if (!moved) throw new AppError('INTERNAL', { reason: 'order is not waiting for approval' });
  }

  /** The order now, with its confirm card while quoted. */
  async card(userId: string, orderId: string, nowMs: number): Promise<CreateOrderResult> {
    const row = this.repo.findForUser(orderId, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    return this.quotes.current(userId, row, nowMs);
  }

  /** Store name and amount for the approval card. */
  summary(orderId: string, userId: string): { merchantId: string; store: string; amount: string } {
    const row = this.repo.findForUser(orderId, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    return {
      merchantId: row.merchantId,
      store: this.merchants.orderInfoOf(row.merchantId)?.name ?? '가게',
      amount: row.amountAokrw,
    };
  }
}
