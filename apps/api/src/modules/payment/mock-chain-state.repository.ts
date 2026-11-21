import { Inject, Injectable } from '@nestjs/common';
import { inArray, sql } from 'drizzle-orm';
import type { Hex } from '@sikyeoyong/shared';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { agents, orders, ownerAllowanceEntries } from '../../db/schema/index.js';
import type { MockChainSnapshot } from './mock-payment.provider.js';

/** Orders whose payment went through on the (mock) chain; the ones that burned the float. */
const PAID = ['paid', 'preparing', 'delivering', 'delivered', 'refunded'] as const;

/**
 * Development only: reads what the in-memory mock chain needs back after a restart. A payment
 * module read of agents, orders and the allowance ledger, like AgentKeysRepository reads its own
 * table; nothing is written. Never used with a real provider.
 */
@Injectable()
export class MockChainStateRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  snapshot(): MockChainSnapshot {
    const db = this.handle.db;
    const rows = db
      .select()
      .from(agents)
      .where(sql`${agents.paymentPath} = 'mock' and ${agents.walletAddress} is not null`)
      .all();
    const ledger = new Map<string, bigint>();
    for (const e of db.select().from(ownerAllowanceEntries).all()) {
      if (e.kind === 'trial') continue;
      const sign = e.kind === 'fund' ? 1n : -1n;
      ledger.set(e.userId, (ledger.get(e.userId) ?? 0n) + sign * BigInt(e.amountAokrw));
    }
    const paidRows = db
      .select()
      .from(orders)
      .where(inArray(orders.status, PAID))
      .orderBy(orders.createdAt)
      .all()
      .filter((o) => o.txHash !== null);
    const addressOf = new Map(rows.map((a) => [a.id, a.walletAddress as Hex]));
    const spent = new Map<string, bigint>();
    const paid: MockChainSnapshot['paid'][number][] = [];
    for (const o of paidRows) {
      const address = addressOf.get(o.agentId);
      if (address === undefined) continue;
      const amount = BigInt(o.amountAokrw);
      spent.set(o.agentId, (spent.get(o.agentId) ?? 0n) + amount);
      paid.push({
        address,
        orderRef: o.orderRef as Hex,
        txHash: o.txHash as Hex,
        amount,
        atMs: o.createdAt,
      });
    }
    return {
      wallets: rows.map((a) => {
        const live = a.status === 'ACTIVE' || a.status === 'FROZEN';
        const float = (ledger.get(a.userId) ?? 0n) - (spent.get(a.id) ?? 0n);
        return {
          address: a.walletAddress as Hex,
          limit: live && a.setupStep === 'done' ? BigInt(a.perOrderLimitAokrw) : null,
          paused: a.status === 'FROZEN',
          balance: float > 0n ? float : 0n,
        };
      }),
      paid,
    };
  }
}
