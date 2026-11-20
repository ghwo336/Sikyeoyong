import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  type AgentWallet,
  type AppErrorCode,
  type Hex,
  type OrderResult,
  type OwnerAuthority,
  type PaymentProvider,
  parseAokrw,
} from '@sikyeoyong/shared';
import { AgentsService } from '../agents/agents.service.js';
import { ApprovalsService, approvalReasonOf } from '../approvals/approvals.service.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER, runOwnerAction } from '../payment/payment.service.js';
import { UsersService } from '../users/users.service.js';
import { classify, isRetryableFailure } from './failure-class.js';
import { parseStoredLines, priceLines } from './order-lines.js';
import { OrderRules } from './order-rules.service.js';
import { toOrderView } from './order-view.js';
import { type OrderRow, OrdersRepository } from './orders.repository.js';

type Checked =
  | { readonly kind: 'pay'; readonly wallet: AgentWallet; readonly merchantOnchainId: bigint }
  | { readonly kind: 'approval'; readonly code: AppErrorCode };

/**
 * POST /orders/:id/confirm, the only place an order is paid (CLAUDE.md rule 3).
 * payment.md "confirm 상태 규칙" (D-19) is the source: the order's state makes it
 * idempotent, every change is one conditional UPDATE so one racing request wins,
 * a failure is never retried by the server (rule 9), and an unknown result stays
 * submitting. The order is answered as it is after this call, never 409.
 */
@Injectable()
export class OrderConfirmService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    private readonly repo: OrdersRepository,
    private readonly rules: OrderRules,
    private readonly agents: AgentsService,
    private readonly users: UsersService,
    private readonly merchants: MerchantsService,
    private readonly approvals: ApprovalsService,
  ) {}

  async confirm(userId: string, orderId: string, nowMs: number = Date.now()): Promise<OrderResult> {
    const row = this.repo.findForUser(orderId, userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'order not found' });
    const toSubmitting = {
      status: 'submitting',
      errorCode: null,
    } as const;
    if (row.status === 'quoted') {
      if (this.repo.transition(row.id, 'quoted', toSubmitting, nowMs, { bumpAttempt: true })) {
        await this.payOnce(userId, row, nowMs);
      }
    } else if (row.status === 'failed' && this.mayRetry(row)) {
      // A person pressed again: ask the chain first, then the same orderRef (D-19).
      const paid = await this.payment.findPaid(row.orderRef as Hex);
      if (paid !== null) {
        this.repo.transition(
          row.id,
          'failed',
          { status: 'paid', txHash: paid.txHash, errorCode: null },
          nowMs,
        );
      } else if (
        this.repo.transition(row.id, 'failed', toSubmitting, nowMs, { bumpAttempt: true })
      ) {
        await this.payOnce(userId, row, nowMs);
      }
    }
    return { order: this.view(userId, orderId, nowMs) };
  }

  /** Path C has no proven same-orderRef guard yet, so a failed order is not paid again there (Q-24). */
  private mayRetry(row: OrderRow): boolean {
    return isRetryableFailure(row.errorCode) && this.payment.path !== 'C';
  }

  /** This request won the order into submitting: check, top up, mark, pay, settle. Once. */
  private async payOnce(userId: string, row: OrderRow, nowMs: number): Promise<void> {
    let marked = false;
    try {
      const checked = await this.check(userId, row, nowMs);
      if (checked.kind === 'approval') {
        this.toApproval(userId, row, checked.code, nowMs);
        return;
      }
      const req = {
        agent: checked.wallet,
        merchantOnchainId: checked.merchantOnchainId,
        amount: parseAokrw(row.amountAokrw),
        orderRef: row.orderRef as Hex,
      };
      await this.topUp(checked.wallet, req.amount);
      const pre = await this.payment.preflight(req);
      if (!pre.ok) {
        this.settle(userId, row, pre.error.code, false, nowMs);
        return;
      }
      // The submit-start marker is committed before anything goes out (D-19).
      marked = this.repo.transition(row.id, 'submitting', { submitStartedAt: nowMs }, nowMs);
      if (!marked) throw new AppError('INTERNAL', { reason: 'order left submitting before pay' });
      const result = await this.payment.pay(req);
      if (result.ok) {
        this.repo.transition(
          row.id,
          'submitting',
          { status: 'paid', txHash: result.txHash },
          nowMs,
        );
        return;
      }
      this.settle(userId, row, result.error.code, true, nowMs);
    } catch (e) {
      // After the marker a throw is a timeout or a lost answer, whatever its code: the
      // payment may be out, so the order stays submitting (D-19 "결과 모름"). Only a
      // returned PayResult settles it. Before the marker no payment went out.
      if (marked) return;
      this.settle(userId, row, e instanceof AppError ? e.code : 'INTERNAL', false, nowMs);
    }
  }

  /**
   * The server's checks again, as of now (payment.md, tech-spec 1.4 flow 1 step 5):
   * frozen, the store, the price (no quote expiry: a changed price is a new quote),
   * the 30-day cap, then the rules that ask the owner, skipping a budget overrun the
   * owner already approved for exactly this amount.
   */
  private async check(userId: string, row: OrderRow, nowMs: number): Promise<Checked> {
    const agent = this.agents.getForUser(userId);
    if (!agent.ready) throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'not hatched' });
    if (agent.frozen) throw new AppError('SERVER_FROZEN', { reason: 'agent is frozen' });
    const found = this.merchants.lookupForOrder(row.merchantId, nowMs);
    if (found.status === 'unknown') throw new AppError('NOT_FOUND', { reason: 'merchant gone' });
    if (found.status === 'not_orderable') {
      throw new AppError('CHAIN_MERCHANT_INACTIVE', { reason: found.reason });
    }
    const items = parseStoredLines(row.itemsJson).map((l) => ({
      menuId: l.menuId,
      qty: l.quantity,
    }));
    const amount = parseAokrw(row.amountAokrw);
    if (priceLines(items, found.menus).total !== amount) {
      throw new AppError('SERVER_PRICE_CHANGED', { reason: 'menu price changed since the quote' });
    }
    await this.rules.periodUsedOrRefuse(agent, amount, nowMs);
    const budgetApproved = this.approvals.budgetApprovedFor(row.id, row.amountAokrw);
    const code = this.rules.approvalNeeded(
      userId,
      agent,
      row.merchantId,
      amount,
      nowMs,
      budgetApproved,
    );
    if (code !== null) return { kind: 'approval', code };
    const onchainId = this.merchants.orderInfoOf(row.merchantId)?.onchainId ?? null;
    if (onchainId === null && this.payment.path !== 'mock') {
      // Not registered on chain yet (Q-34): the contract would refuse it.
      throw new AppError('CHAIN_MERCHANT_INACTIVE', { reason: 'merchant not on chain' });
    }
    return {
      kind: 'pay',
      wallet: this.agents.walletForPayment(userId),
      merchantOnchainId: onchainId ?? 0n,
    };
  }

  /**
   * Mode P: the agent wallet must hold the amount. The server tops up only the
   * shortfall, just before paying (tech-spec 3.4), so the wallet never holds more
   * than this order. Server code only, never an LLM tool (payment.md).
   */
  private async topUp(wallet: AgentWallet, amount: bigint): Promise<void> {
    const balance = await this.payment.balanceOf(wallet.address);
    if (balance >= amount) return;
    const r = await runOwnerAction(this.owner, {
      kind: 'fund',
      agent: wallet,
      amount: amount - balance,
    });
    if (!r.done) throw new AppError('INTERNAL', { reason: 'top-up waits for the owner signature' });
  }

  /** Moves the order out of submitting by the class of the refusal (payment.md "실패 분류"). */
  private settle(
    userId: string,
    row: OrderRow,
    code: AppErrorCode,
    marked: boolean,
    nowMs: number,
  ): void {
    const cls = classify(code, !marked);
    if (cls === 'approval') {
      this.toApproval(userId, row, code, nowMs);
    } else if (cls === 'retryable' || cls === 'final') {
      this.repo.transition(row.id, 'submitting', { status: 'failed', errorCode: code }, nowMs);
    } else if (!marked) {
      // Nothing went out before the marker, so nothing can have been paid.
      this.repo.transition(
        row.id,
        'submitting',
        { status: 'failed', errorCode: 'INTERNAL' },
        nowMs,
      );
    }
    // After the marker anything else is an unknown result: stay submitting (D-19).
  }

  /** submitting to pending_approval with its approval row, in one transaction (D-19). */
  private toApproval(userId: string, row: OrderRow, code: AppErrorCode, nowMs: number): void {
    const reason = approvalReasonOf(code);
    if (reason === null) throw new AppError('INTERNAL', { reason: 'not an approval code' });
    this.approvals.openWithOrder(
      {
        userId,
        agentId: row.agentId,
        orderId: row.id,
        reason,
        payload: { merchantId: row.merchantId, amount: row.amountAokrw },
      },
      () => {
        const moved = this.repo.transition(
          row.id,
          'submitting',
          { status: 'pending_approval' },
          nowMs,
        );
        if (!moved) throw new AppError('INTERNAL', { reason: 'order left submitting' });
      },
      nowMs,
    );
  }

  private view(userId: string, orderId: string, nowMs: number) {
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
