import { Injectable } from '@nestjs/common';
import { AppError, type CreateOrderResult, parseAokrw } from '@sikyeoyong/shared';
import { AgentsService } from '../agents/agents.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { OrderApprovalEffects } from './order-approval-effects.service.js';
import { OrdersRepository } from './orders.repository.js';

/**
 * POST /orders/:id/requote (user-flow 12 "O -> I"): after the owner raised the per-order limit
 * from the Blocked screen, the order that waited for it comes back as a quote. Only an order
 * waiting on OVER_LEVEL_LIMIT whose amount now fits the stored per-order limit moves: its
 * approval is closed as approved and the order goes back to quoted, in one transaction. Never
 * pays: the confirm card button (POST /orders/:id/confirm) is still the only payment, and confirm
 * checks every rule again (CLAUDE.md rule 3, D-19). Anything else (still over, another reason,
 * the approval expired, already quoted) answers the order as it is, so a second call is harmless.
 */
@Injectable()
export class OrderRequoteService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly approvals: ApprovalsService,
    private readonly agents: AgentsService,
    private readonly effects: OrderApprovalEffects,
  ) {}

  async requote(
    userId: string,
    orderId: string,
    nowMs: number = Date.now(),
  ): Promise<CreateOrderResult> {
    const row = this.repo.findForUser(orderId, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    if (row.status === 'pending_approval') {
      const approval = this.approvals.pendingForOrder(orderId);
      const fits = parseAokrw(row.amountAokrw) <= this.agents.getForUser(userId).perOrderLimitAokrw;
      if (
        approval !== undefined &&
        approval.reason === 'OVER_LEVEL_LIMIT' &&
        approval.expiresAt > nowMs &&
        fits
      ) {
        this.approvals.decide(
          approval,
          'approved',
          () => {
            this.effects.reopen(orderId, nowMs);
          },
          nowMs,
        );
      }
    }
    return this.effects.card(userId, orderId, nowMs);
  }
}
