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
import { ApprovalsService, approvalReasonOf } from '../approvals/approvals.service.js';
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
  ): Promise<CreateOrderResult> {
    if (req.clientOrderId !== null) {
      const before = this.repo.findByClientOrderId(userId, req.clientOrderId);
      if (before !== undefined) return this.replay(userId, before, req, nowMs);
    }
    const agent = this.agents.getForUser(userId);
    if (!agent.ready) throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'not hatched yet' });
    if (agent.frozen) throw new AppError('SERVER_FROZEN', { reason: 'agent is frozen' });
    const merchant = this.orderableMerchant(req.merchantId, nowMs);
    const { lines, total } = priceLines(req.items, merchant.menus);
    const periodUsed = await this.rules.periodUsedOrRefuse(agent, total, nowMs);
    const refusal = this.rules.approvalNeeded(userId, agent, req.merchantId, total, nowMs);

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
      createdAt: nowMs,
    };
    try {
      if (refusal === null) {
        this.repo.insert({ ...row, status: 'quoted' });
      } else {
        const reason = approvalReasonOf(refusal);
        if (reason === null) throw new AppError('INTERNAL', { reason: 'not an approval code' });
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
      if (winner !== undefined) return this.replay(userId, winner, req, nowMs);
      throw e;
    }
    if (refusal !== null) return { order: { id: orderId, status: 'pending_approval' } };
    return {
      order: { id: orderId, status: 'quoted' },
      quote: this.quoteView(userId, orderId, merchant.card, lines, total, agent, periodUsed),
    };
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
  ): OrderQuote {
    const policy = this.config.policy;
    const first = lines[0]?.name ?? '';
    return {
      orderId,
      store: merchant.name,
      destination: this.users.getDestination(userId),
      etaMin: merchant.etaMin,
      items: toItemLines(lines),
      amount: aokrwToString(total),
      dragonLine: `${first} 시킬게용.\n이대로 괜찮아용?`,
      perOrderLimit: aokrwToString(policy.perOrderLimitAokrw[agent.level]),
      periodUsedAfter: aokrwToString(periodUsed + total),
      periodCap: aokrwToString(policy.periodicCapAokrw),
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
    const order = { id: row.id, status: row.status };
    if (row.status !== 'quoted') return { order };
    const found = this.merchants.lookupForOrder(row.merchantId, nowMs);
    if (found.status !== 'ok') return { order };
    const agent = this.agents.getForUser(userId);
    const total = parseAokrw(row.amountAokrw);
    const volume = await this.chain.periodicVolume(agent.wallet);
    return {
      order,
      quote: this.quoteView(userId, row.id, found.merchant, lines, total, agent, volume.usedAokrw),
    };
  }
}
