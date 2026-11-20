import { Injectable } from '@nestjs/common';
import { AppError, type TasteRating } from '@sikyeoyong/shared';
import { OrdersRepository } from './orders.repository.js';

/** Orders that were paid: only these can be rated (the Arrived screen comes after paying). */
const RATEABLE = new Set(['paid', 'preparing', 'delivering', 'delivered']);

/**
 * POST /orders/:id/rating (Arrived.dc.html "맛은 어땠어용?"): the owner's taste word for a paid
 * order. Someone else's order or an unknown id is 404, an unpaid one is 409. A second rating
 * replaces the first. Recommendations read it later (follow-up).
 */
@Injectable()
export class OrderRatingService {
  constructor(private readonly repo: OrdersRepository) {}

  rate(userId: string, orderId: string, value: TasteRating, nowMs: number = Date.now()): void {
    const order = this.repo.findForUser(orderId, userId);
    if (order === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    if (!RATEABLE.has(order.status)) {
      throw new AppError('CONFLICT', { reason: 'only a paid order can be rated' });
    }
    this.repo.rate(orderId, userId, value, nowMs);
  }
}
