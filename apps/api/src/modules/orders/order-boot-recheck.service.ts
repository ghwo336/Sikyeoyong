import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Hex, PaymentProvider } from '@sikyeoyong/shared';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { type OrderRow, OrdersRepository } from './orders.repository.js';

/** What one boot pass did, for the log and the tests. */
export interface RecheckResult {
  readonly paid: number;
  readonly failed: number;
  readonly waiting: number;
}

/**
 * On start, every order left in `submitting` is looked at again (payment.md "submitting을 끝내는
 * 규칙": the process may have died around `pay`). This only reads: it never sends a payment
 * (CLAUDE.md rule 9, D-19).
 *  - no submit-start marker: nothing was ever broadcast, so a retryable failed order.
 *  - marker, and the chain has OrderPlaced(orderRef): paid.
 *  - marker, nothing on chain (or the chain cannot be asked): stays submitting. A missing hash is
 *    not "not sent" and an unseen receipt is not "reverted"; a person checks it.
 * The orders are read once, synchronously, before the server listens: an order a request starts
 * later is never judged by this pass. The chain lookups then run in the background so a slow RPC
 * does not hold the boot.
 */
@Injectable()
export class OrderBootRecheck implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrderBootRecheck.name);
  /** Settles when the background pass is done (tests await it). */
  pass: Promise<RecheckResult> = Promise.resolve({ paid: 0, failed: 0, waiting: 0 });

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    private readonly repo: OrdersRepository,
  ) {}

  onApplicationBootstrap(): void {
    this.pass = this.run();
    this.pass.catch((e: unknown) => {
      this.logger.error(`submitting recheck stopped: ${(e as Error).name}`);
    });
  }

  /** The snapshot is taken here, before the first await (async: a read error is a rejection). */
  async run(nowMs: number = Date.now()): Promise<RecheckResult> {
    const stuck = this.repo.withStatus('submitting');
    return this.recheck(stuck, nowMs);
  }

  private async recheck(stuck: readonly OrderRow[], nowMs: number): Promise<RecheckResult> {
    let paid = 0;
    let failed = 0;
    let waiting = 0;
    for (const row of stuck) {
      if (row.submitStartedAt === null) {
        const moved = this.repo.transition(
          row.id,
          'submitting',
          { status: 'failed', errorCode: 'INTERNAL' },
          nowMs,
        );
        if (moved) failed += 1;
        continue;
      }
      let found: { txHash: Hex } | null = null;
      try {
        found = await this.payment.findPaid(row.orderRef as Hex);
      } catch (e) {
        this.logger.warn(
          `order ${row.id} still submitting, chain not readable (${(e as Error).name})`,
        );
      }
      if (found !== null) {
        const moved = this.repo.transition(
          row.id,
          'submitting',
          { status: 'paid', txHash: found.txHash, errorCode: null },
          nowMs,
        );
        if (moved) paid += 1;
        continue;
      }
      waiting += 1;
      this.logger.warn(`order ${row.id} still submitting, no OrderPlaced for its orderRef yet`);
    }
    if (stuck.length > 0) {
      this.logger.log(`submitting recheck: ${paid} paid, ${failed} failed, ${waiting} waiting`);
    }
    return { paid, failed, waiting };
  }
}
