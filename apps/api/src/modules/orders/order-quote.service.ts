import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  aokrwToString,
  type CreateOrderResult,
  type MerchantCard,
  type OrderQuote,
  parseAokrw,
} from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { type AgentSummary, AgentsService } from '../agents/agents.service.js';
import {
  type ApprovalReason,
  APPROVAL_TTL_MS,
  ApprovalsService,
  approvalReasonOf,
} from '../approvals/approvals.service.js';
import { CHAIN_READER, type ChainReader } from '../chain/chain.service.js';
import { type MenuItem, MerchantsService } from '../merchants/merchants.service.js';
import { UsersService } from '../users/users.service.js';
import {
  parseStoredLines,
  priceLines,
  type RequestedItem,
  sameRequest,
  type StoredLine,
  toItemLines,
} from './order-lines.js';
import { orderRefOf } from './order-ref.js';
import { OrdersRepository, type OrderRow } from './orders.repository.js';
import { OrderRules } from './order-rules.service.js';

export interface QuoteRequest {
  readonly merchantId: string;
  readonly items: readonly RequestedItem[];
  /** POST /orders idempotency key; place_order passes null. */
  readonly clientOrderId: string | null;
  /** The user's request to the store (place_order note), at most 100 characters. */
  readonly note?: string;
}

/** The result the screens get, and for the place_order tool why the owner is asked. */
export interface QuoteOutcome {
  readonly result: CreateOrderResult;
  /** Set when this call made a pending_approval order; null on a quote or a resend. */
  readonly approvalReason: ApprovalReason | null;
}

/**
 * Makes a quote, never a payment (CLAUDE.md rule 3, tech-spec 1.4 flow 1 step 4).
 * POST /orders and the place_order tool share it. The server prices the items,
 * checks its own rules and either writes a quoted order (the confirm card) or a
 * pending_approval order with its approval row (flow 3, D-19).
 */
@Injectable()
export class OrderQuoteService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CHAIN_READER) private readonly chain: ChainReader,
    private readonly repo: OrdersRepository,
    private readonly rules: OrderRules,
    private readonly agents: AgentsService,
    private readonly users: UsersService,
    private readonly merchants: MerchantsService,
    private readonly approvals: ApprovalsService,
  ) {}

  async create(
    userId: string,
    req: QuoteRequest,
    nowMs: number = Date.now(),
  ): Promise<QuoteOutcome> {
    const outcome = await this.write(userId, req, nowMs, false);
    if (outcome === null) throw new AppError('INTERNAL', { reason: 'quote not written' });
    return outcome;
  }

  /**
   * request_owner_approval with nothing waiting: write the order only if the server's
   * rules ask the owner (a pending_approval order and its approval). If they do not,
   * write nothing and return null; ordering stays place_order's job (one order per
   * message, tech-spec 3.3).
   */
  createIfApprovalNeeded(
    userId: string,
    req: QuoteRequest,
    nowMs: number,
  ): Promise<QuoteOutcome | null> {
    return this.write(userId, req, nowMs, true);
  }

  private async write(
    userId: string,
    req: QuoteRequest,
    nowMs: number,
    approvalOnly: boolean,
  ): Promise<QuoteOutcome | null> {
    if (req.clientOrderId !== null) {
      const before = this.repo.findByClientOrderId(userId, req.clientOrderId);
      if (before !== undefined) return resent(await this.replay(userId, before, req, nowMs));
    }
    const agent = this.agents.getForUser(userId);
    if (!agent.ready) throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'not hatched yet' });
    if (agent.frozen) throw new AppError('SERVER_FROZEN', { reason: 'agent is frozen' });
    const merchant = this.orderableMerchant(req.merchantId, nowMs);
    const { lines, total } = priceLines(req.items, merchant.menus);
    const periodUsed = await this.rules.periodUsedOrRefuse(agent, total, nowMs);
    const refusal = this.rules.approvalNeeded(userId, agent, req.merchantId, total, periodUsed);
    const reason = refusal === null ? null : approvalReasonOf(refusal);
    if (refusal !== null && reason === null) {
      throw new AppError('INTERNAL', { reason: 'not an approval code' });
    }

    if (approvalOnly && reason === null) return null;
    // QA 6: the same request again (a re-picked card, the dragon asking twice) is the order that
    // is already open, never a second approval or a second card for it.
    const open = this.reusableOrder(userId, req, total, reason, nowMs);
    if (open !== undefined) {
      return {
        result: await this.current(userId, open, nowMs),
        approvalReason: open.status === 'pending_approval' ? reason : null,
      };
    }
    const orderId = uuidv7(nowMs);
    const row = {
      id: orderId,
      orderRef: orderRefOf(orderId),
      userId,
      agentId: agent.id,
      merchantId: req.merchantId,
      amountAokrw: aokrwToString(total),
      itemsJson: JSON.stringify(lines),
      clientOrderId: req.clientOrderId,
      note: req.note ?? null,
      perOrderLimitAtQuote: aokrwToString(agent.perOrderLimitAokrw),
      periodCapAtQuote: aokrwToString(this.config.policy.periodicCapAokrw),
      createdAt: nowMs,
    };
    try {
      if (reason === null) {
        this.repo.insert({ ...row, status: 'quoted' });
      } else {
        this.approvals.openWithOrder(
          {
            userId,
            agentId: agent.id,
            orderId,
            reason,
            payload: { merchantId: req.merchantId, amount: row.amountAokrw },
          },
          () => {
            this.repo.insert({ ...row, status: 'pending_approval' });
          },
          nowMs,
        );
      }
    } catch (e) {
      // Lost a race with the same clientOrderId: answer like the first request did.
      const winner =
        req.clientOrderId === null
          ? undefined
          : this.repo.findByClientOrderId(userId, req.clientOrderId);
      if (winner !== undefined) return resent(await this.replay(userId, winner, req, nowMs));
      throw e;
    }
    if (reason !== null) {
      return {
        result: { order: { id: orderId, status: 'pending_approval' } },
        approvalReason: reason,
      };
    }
    return {
      result: {
        order: { id: orderId, status: 'quoted' },
        quote: this.quoteView(
          userId,
          orderId,
          merchant.card,
          lines,
          total,
          agent,
          periodUsed,
          row.note,
        ),
      },
      approvalReason: null,
    };
  }

  /**
   * The user's open order for the same store, items, price and note: waiting for the owner with a
   * live approval while the rules still ask the owner, or quoted within the approval window while
   * they still do not. Anything else (expired, rules changed, price moved) gets a new order.
   */
  private reusableOrder(
    userId: string,
    req: QuoteRequest,
    total: bigint,
    reason: ApprovalReason | null,
    nowMs: number,
  ): OrderRow | undefined {
    return this.repo.openAt(userId, req.merchantId).find((o) => {
      if (o.amountAokrw !== aokrwToString(total) || o.note !== (req.note ?? null)) return false;
      const stored = {
        merchantId: o.merchantId,
        items: parseStoredLines(o.itemsJson).map((l) => ({ menuId: l.menuId, qty: l.quantity })),
      };
      if (!sameRequest(stored, req)) return false;
      if (o.status === 'pending_approval') {
        const approval = this.approvals.pendingForOrder(o.id);
        return reason !== null && approval !== undefined && approval.expiresAt > nowMs;
      }
      return reason === null && o.createdAt + APPROVAL_TTL_MS > nowMs;
    });
  }

  private orderableMerchant(
    merchantId: string,
    nowMs: number,
  ): { card: MerchantCard; menus: ReadonlyMap<string, MenuItem> } {
    const found = this.merchants.lookupForOrder(merchantId, nowMs);
    if (found.status === 'unknown')
      throw new AppError('NOT_FOUND', { reason: 'merchant not found' });
    if (found.status === 'not_orderable') {
      throw new AppError('CHAIN_MERCHANT_INACTIVE', { reason: found.reason });
    }
    return { card: found.merchant, menus: found.menus };
  }

  private quoteView(
    userId: string,
    orderId: string,
    merchant: MerchantCard,
    lines: readonly StoredLine[],
    total: bigint,
    agent: AgentSummary,
    periodUsed: bigint,
    note: string | null,
  ): OrderQuote {
    const policy = this.config.policy;
    const first = lines[0]?.name ?? '';
    const mine = this.users.getMyPeriodicLimitAokrw(userId);
    return {
      orderId,
      store: merchant.name,
      destination: this.users.getDestination(userId),
      etaMin: merchant.etaMin,
      items: toItemLines(lines),
      ...(note === null ? {} : { request: note }),
      amount: aokrwToString(total),
      dragonLine: `${first} 시킬게용.\n이대로 괜찮아용?`,
      perOrderLimit: aokrwToString(agent.perOrderLimitAokrw),
      periodUsedAfter: aokrwToString(periodUsed + total),
      // D-31: the card shows the owner's own 30-day limit (the meter on the budget screen) when it
      // is below the chain's shared cap; at the cap both are the same number.
      periodCap: aokrwToString(mine < policy.periodicCapAokrw ? mine : policy.periodicCapAokrw),
    };
  }

  /**
   * The order as it is now, with its confirm card while it is quoted and its store can
   * still take it (a resend, or the order quoted again after the owner's approval).
   */
  async current(userId: string, row: OrderRow, nowMs: number): Promise<CreateOrderResult> {
    const lines = parseStoredLines(row.itemsJson);
    const order = { id: row.id, status: row.status };
    if (row.status !== 'quoted') return { order };
    const found = this.merchants.lookupForOrder(row.merchantId, nowMs);
    if (found.status !== 'ok') return { order };
    const agent = this.agents.getForUser(userId);
    const total = parseAokrw(row.amountAokrw);
    const volume = await this.chain.periodicVolume(agent.wallet);
    return {
      order,
      quote: this.quoteView(
        userId,
        row.id,
        found.merchant,
        lines,
        total,
        agent,
        volume.usedAokrw,
        row.note,
      ),
    };
  }

  /** A resend with a used clientOrderId: the same request gets the order as it is now; another is 409. */
  private async replay(
    userId: string,
    row: OrderRow,
    req: QuoteRequest,
    nowMs: number,
  ): Promise<CreateOrderResult> {
    const lines = parseStoredLines(row.itemsJson);
    const stored = {
      merchantId: row.merchantId,
      items: lines.map((l) => ({ menuId: l.menuId, qty: l.quantity })),
    };
    if (!sameRequest(stored, req)) {
      throw new AppError('CONFLICT', { reason: 'clientOrderId used for another order' });
    }
    return this.current(userId, row, nowMs);
  }
}

/** A resend never opens an approval, so the tool learns nothing new about why. */
function resent(result: CreateOrderResult): QuoteOutcome {
  return { result, approvalReason: null };
}
