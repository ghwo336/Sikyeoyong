import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { AgentsService } from '../agents/agents.service.js';
import { buildReceiptJson } from './order-receipt.js';
import { type OrderRow, OrdersRepository, type OrderStatus } from './orders.repository.js';

/**
 * Moves an order to paid and writes its receipt in the same UPDATE (confirm, the retry of a failed
 * order found paid on chain, boot recheck and the indexer all end here), so a paid order never lacks the checks it passed.
 */
@Injectable()
export class OrderReceipts {
  private readonly log = new Logger(OrderReceipts.name);

  constructor(
    private readonly repo: OrdersRepository,
    private readonly agents: AgentsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Returns whether this call won the order into paid. */
  markPaid(row: OrderRow, from: OrderStatus, txHash: string, nowMs: number): boolean {
    let receiptJson: string | null;
    try {
      receiptJson = buildReceiptJson({
        onchainAgentId: this.agents.onchainAgentIdOf(row.agentId),
        txHash,
        path: this.config.payment.path,
        chain: this.config.chain,
      });
    } catch (err) {
      this.log.warn(
        `receipt not built for order ${row.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      // A receipt that cannot be built must not hold back a payment that already happened.
      receiptJson = null;
    }
    return this.repo.transition(
      row.id,
      from,
      { status: 'paid', txHash, errorCode: null, ...(receiptJson === null ? {} : { receiptJson }) },
      nowMs,
    );
  }
}
