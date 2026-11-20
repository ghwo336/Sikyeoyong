import { Inject, Injectable } from '@nestjs/common';
import { AppError, ORDER_LIST_MAX, type OrderView } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { UsersService } from '../users/users.service.js';
import { toOrderView } from './order-view.js';
import { type OrderRow, OrdersRepository, type OrderStatus } from './orders.repository.js';

/** Quoted orders were never confirmed (only a card), so the order list leaves them out. */
const LEFT_OUT_OF_LIST: readonly OrderStatus[] = ['quoted'];

/** Orders as the status screens read them (GET /orders, GET /orders/:id and confirm's answer). */
@Injectable()
export class OrderViews {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly merchants: MerchantsService,
    private readonly users: UsersService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The session user's order; another user's is NOT_FOUND, never FORBIDDEN (no existence leak). */
  viewFor(userId: string, orderId: string, nowMs: number = Date.now()): OrderView {
    const row = this.repo.findForUser(orderId, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    return this.toView(row, this.users.getDestination(userId), nowMs);
  }

  /**
   * The session user's recent orders, newest first, at most ORDER_LIST_MAX (GET /orders). Each
   * is built exactly like viewFor, so the list and the status screens show the same status.
   */
  listFor(userId: string, nowMs: number = Date.now()): OrderView[] {
    const destination = this.users.getDestination(userId);
    return this.repo
      .recentForUser(userId, LEFT_OUT_OF_LIST, ORDER_LIST_MAX)
      .map((row) => this.toView(row, destination, nowMs));
  }

  private toView(row: OrderRow, destination: string, nowMs: number): OrderView {
    const info = this.merchants.orderInfoOf(row.merchantId);
    return toOrderView(
      row,
      {
        store: info?.name ?? '가게',
        destination,
        etaMin: info?.etaMin ?? 0,
        // No delivery feed yet: the mock chain and the demo play the stages out by time.
        simulateDelivery: this.config.payment.path === 'mock' || this.config.demo.enabled,
      },
      nowMs,
    );
  }
}
