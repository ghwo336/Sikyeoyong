import { Injectable } from '@nestjs/common';
import { kstMonthRange, parseAokrw } from '@sikyeoyong/shared';
import { type OrderStatus, OrdersRepository } from './orders.repository.js';

/**
 * Statuses that count as spent for the personal budget: paid and everything
 * after it short of a refund (tech-spec 3.7, recommend-and-nag.md "paid 이상").
 * The indexer moves orders to paid only after the chain confirms them.
 */
export const SPENT_STATUSES: readonly OrderStatus[] = [
  'paid',
  'preparing',
  'delivering',
  'delivered',
];

/** The personal budget's spend, inside the orders module (OrdersService exposes it). */
@Injectable()
export class OrderSpend {
  constructor(private readonly repo: OrdersRepository) {}

  /** Personal budget spend in a KST calendar month, summed in bigint (never SQL sum on text). */
  spentInMonthAokrw(userId: string, monthKst: string): bigint {
    const { startMs, endMs } = kstMonthRange(monthKst);
    return this.repo
      .amountsBetween(userId, SPENT_STATUSES, startMs, endMs)
      .reduce((sum, a) => sum + parseAokrw(a), 0n);
  }
}
