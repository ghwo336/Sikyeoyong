import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { AllowanceService } from '../allowance/allowance.service.js';
import { AgentsService } from '../agents/agents.service.js';
import { ApprovalsService } from '../approvals/approvals.service.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER, runOwnerAction } from '../payment/payment.service.js';
import { isRetryableFailure } from './failure-class.js';
import { parseStoredLines, priceLines } from './order-lines.js';
import { OrderSettler } from './order-settler.service.js';
import { OrderRules } from './order-rules.service.js';
import { OrderViews } from './order-views.service.js';
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
  private readonly logger = new Logger(OrderConfirmService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    private readonly repo: OrdersRepository,
    private readonly rules: OrderRules,
    private readonly agents: AgentsService,
    private readonly views: OrderViews,
    private readonly merchants: MerchantsService,
    private readonly approvals: ApprovalsService,
    private readonly allowance: AllowanceService,
    private readonly settler: OrderSettler,
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
    return { order: this.views.viewFor(userId, orderId, nowMs) };
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
        this.settler.toApproval(userId, row, checked.code, nowMs);
        return;
      }
      const req = {
        agent: checked.wallet,
        merchantOnchainId: checked.merchantOnchainId,
        amount: parseAokrw(row.amountAokrw),
        orderRef: row.orderRef as Hex,
      };
      await this.topUp(userId, row, checked.wallet, req.amount, nowMs);
      const pre = await this.payment.preflight(req);
      if (!pre.ok) {
        this.settler.settle(userId, row, pre.error.code, false, nowMs);
        return;
      }
      // The submit-start marker is committed before anything goes out (D-19).
      marked = this.repo.transition(row.id, 'submitting', { submitStartedAt: nowMs }, nowMs);
      if (!marked) throw new AppError('INTERNAL', { reason: 'order left submitting before pay' });
      // Path B saves the signed hash and nonce before the broadcast, so a lost answer can be
      // checked on chain later (payment.md "제출 시작 표시와 순서").
      const result = await this.payment.pay({
        ...req,
        beforeBroadcast: ({ txHash, nonce }) => {
          const saved = this.repo.transition(
            row.id,
            'submitting',
            { submitTxHash: txHash, submitNonce: nonce },
            nowMs,
          );
          if (!saved)
            throw new AppError('INTERNAL', { reason: 'order left submitting before send' });
        },
      });
      if (result.ok) {
        this.repo.transition(
          row.id,
          'submitting',
          { status: 'paid', txHash: result.txHash },
          nowMs,
        );
        return;
      }
      this.settler.settle(userId, row, result.error.code, true, nowMs);
    } catch (e) {
      // After the marker a throw is a timeout or a lost answer, whatever its code: the
      // payment may be out, so the order stays submitting (D-19 "결과 모름"). Only a
      // returned PayResult settles it. Before the marker no payment went out.
      if (marked) return;
      this.settler.settle(userId, row, e instanceof AppError ? e.code : 'INTERNAL', false, nowMs);
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
    const periodUsed = await this.rules.periodUsedOrRefuse(agent, amount, nowMs);
    const budgetApproved = this.approvals.budgetApprovedFor(row.id, row.amountAokrw);
    const code = this.rules.approvalNeeded(
      userId,
      agent,
      row.merchantId,
      amount,
      periodUsed,
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
   * The moved shortfall comes out of the owner allowance ledger (D-24 custodial, wallet screen
   * "주인님 용돈"): recorded only after the fund succeeded, so a failed or skipped top-up records
   * nothing. Refusing an order when the ledger is short is open (open-questions Q-38).
   * The money already moved when the ledger is written, so a ledger failure never turns the
   * payment into a failure: it is logged (user, tx) for reconciliation instead.
   * Idempotent by order (payment.md "즉시 충전(fund)의 멱등성"): a marker on the order is committed
   * before the fund call and the tx hash after it. A marker with no hash is a top-up with no
   * result (the answer was lost); it is never repeated while the balance does not show it, so a
   * retry of the same order cannot fund twice. Once the funds show, the balance check passes.
   */
  private async topUp(
    userId: string,
    row: OrderRow,
    wallet: AgentWallet,
    amount: bigint,
    nowMs: number,
  ): Promise<void> {
    const balance = await this.payment.balanceOf(wallet.address);
    // Path B has no paymaster: the wallet also keeps its gas share (D-25). Others reserve 0.
    const need = amount + (this.payment.gasReserveAokrw ?? 0n);
    if (balance >= need) return;
    const unresolved = row.fundStartedAt !== null && row.fundTxHash === null;
    if (unresolved || !this.repo.markFundStart(row.id, (need - balance).toString(), nowMs)) {
      throw new AppError('INTERNAL', {
        reason: 'an earlier top-up of this order has no result yet, not funding again',
      });
    }
    const r = await runOwnerAction(this.owner, {
      kind: 'fund',
      agent: wallet,
      amount: need - balance,
    });
    if (!r.done) {
      // Nothing was sent: the marker is taken back so the next try may fund.
      this.repo.clearFundStart(row.id, nowMs);
      throw new AppError('INTERNAL', { reason: 'top-up waits for the owner signature' });
    }
    // fund sends one transaction; its hash is the record's.
    const txHash = r.txHashes[0] ?? null;
    if (txHash !== null) this.repo.recordFundTx(row.id, txHash, nowMs);
    try {
      this.allowance.record(userId, 'fund', need - balance, txHash, nowMs);
    } catch (e) {
      this.logger.error(
        `owner allowance fund not recorded: user ${userId} tx ${txHash ?? '-'} (${(e as Error).name})`,
      );
    }
  }
}
