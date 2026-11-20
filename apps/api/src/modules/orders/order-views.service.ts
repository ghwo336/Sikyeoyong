import { Injectable } from '@nestjs/common';
import { AppError, type OrderView } from '@sikyeoyong/shared';
import { MerchantsService } from '../merchants/merchants.service.js';
import { UsersService } from '../users/users.service.js';
import { toOrderView } from './order-view.js';
import { OrdersRepository } from './orders.repository.js';

/** One order as the status screens read it (GET /orders/:id and confirm's answer). */
@Injectable()
export class OrderViews {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly merchants: MerchantsService,
    private readonly users: UsersService,
  ) {}

  /** The session user's order; another user's is NOT_FOUND, never FORBIDDEN (no existence leak). */
  viewFor(userId: string, orderId: string, nowMs: number = Date.now()): OrderView {
    const row = this.repo.findForUser(orderId, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    const info = this.merchants.orderInfoOf(row.merchantId);
    return toOrderView(
      row,
      {
        store: info?.name ?? '가게',
        destination: this.users.getDestination(userId),
        etaMin: info?.etaMin ?? 0,
      },
      nowMs,
    );
  }
}
