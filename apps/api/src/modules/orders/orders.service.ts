import { Injectable } from '@nestjs/common';
import { OrderQuoteService, type QuoteOutcome, type QuoteRequest } from './order-quote.service.js';
import { OrderSpend } from './order-spend.service.js';

export { SPENT_STATUSES } from './order-spend.service.js';
export type { QuoteOutcome, QuoteRequest } from './order-quote.service.js';

/**
 * What other modules may ask of orders (architecture.md: one exported service).
 * The work lives in the orders module's own services; this only forwards.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly spend: OrderSpend,
    private readonly quotes: OrderQuoteService,
  ) {}

  /** Personal budget spend in a KST calendar month (budget module, nag). */
  spentInMonthAokrw(userId: string, monthKst: string): bigint {
    return this.spend.spentInMonthAokrw(userId, monthKst);
  }

  /** A quote, never a payment (the place_order tool; CLAUDE.md rule 3). */
  quote(userId: string, req: QuoteRequest, nowMs?: number): Promise<QuoteOutcome> {
    return this.quotes.create(userId, req, nowMs);
  }
}
