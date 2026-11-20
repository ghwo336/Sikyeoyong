import { Inject, Injectable } from '@nestjs/common';
import type { DragonSpecies } from '@sikyeoyong/shared';
import { and, eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { agentLimitHistory, agents, type SETUP_STEPS } from '../../db/schema/index.js';

export type SetupStep = (typeof SETUP_STEPS)[number];
export type AgentPath = 'A' | 'B' | 'C' | 'mock';

const COLUMNS = {
  id: agents.id,
  userId: agents.userId,
  perOrderLimitAokrw: agents.perOrderLimitAokrw,
  status: agents.status,
  walletAddress: agents.walletAddress,
  onchainAgentId: agents.onchainAgentId,
  ownerAddress: agents.ownerAddress,
  dragonName: agents.dragonName,
  dragonSpecies: agents.dragonSpecies,
  setupStep: agents.setupStep,
  createdAt: agents.createdAt,
};

/** Queries on agents and their limit history only. */
@Injectable()
export class AgentsRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  findByUserId(userId: string) {
    return this.handle.db.select(COLUMNS).from(agents).where(eq(agents.userId, userId)).get();
  }

  findById(id: string) {
    return this.handle.db.select(COLUMNS).from(agents).where(eq(agents.id, id)).get();
  }

  /** Throws on a second dragon for the same user (unique user_id). */
  insert(row: {
    id: string;
    userId: string;
    dragonName: string;
    dragonSpecies: DragonSpecies;
    paymentPath: AgentPath;
    perOrderLimitAokrw: string;
    createdAt: number;
  }): void {
    this.handle.db
      .insert(agents)
      .values({ ...row, status: 'PENDING', setupStep: 'wallet' })
      .run();
  }

  setStep(id: string, setupStep: SetupStep): void {
    this.handle.db.update(agents).set({ setupStep }).where(eq(agents.id, id)).run();
  }

  saveWallet(
    id: string,
    wallet: { address: string; onchainAgentId: string | null; ownerAddress: string },
  ): void {
    this.handle.db
      .update(agents)
      .set({
        walletAddress: wallet.address,
        onchainAgentId: wallet.onchainAgentId,
        ownerAddress: wallet.ownerAddress,
      })
      .where(eq(agents.id, id))
      .run();
  }

  /** The limit is recorded and the agent may order: one transaction, so neither is half done. */
  activate(id: string, limit: { id: string; aokrw: string; txHash: string; at: number }): void {
    this.handle.sqlite.transaction(() => {
      this.handle.db
        .insert(agentLimitHistory)
        .values({
          id: limit.id,
          agentId: id,
          transferLimitAokrw: limit.aokrw,
          txHash: limit.txHash,
          createdAt: limit.at,
        })
        .run();
      this.handle.db
        .update(agents)
        .set({ status: 'ACTIVE', setupStep: 'done' })
        .where(eq(agents.id, id))
        .run();
    })();
  }

  /** Moves the status from one value to another; false if the row was not in `from` (someone else won). */
  changeStatus(id: string, from: 'ACTIVE' | 'FROZEN', to: 'ACTIVE' | 'FROZEN'): boolean {
    return (
      this.handle.db
        .update(agents)
        .set({ status: to })
        .where(and(eq(agents.id, id), eq(agents.status, from)))
        .run().changes === 1
    );
  }

  /**
   * A per-order limit change after its TransferLimit was written (D-31): the amount and its
   * history in one transaction.
   */
  changePerOrderLimit(
    id: string,
    limit: { id: string; aokrw: string; txHash: string | null; at: number },
  ): void {
    this.handle.sqlite.transaction(() => {
      this.handle.db
        .insert(agentLimitHistory)
        .values({
          id: limit.id,
          agentId: id,
          transferLimitAokrw: limit.aokrw,
          txHash: limit.txHash,
          createdAt: limit.at,
        })
        .run();
      this.handle.db
        .update(agents)
        .set({ perOrderLimitAokrw: limit.aokrw })
        .where(eq(agents.id, id))
        .run();
    })();
  }
}
