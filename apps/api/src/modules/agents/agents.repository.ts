import { Inject, Injectable } from '@nestjs/common';
import type { AgentLevel, DragonSpecies } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { agentLimitHistory, agents, type SETUP_STEPS } from '../../db/schema/index.js';

export type SetupStep = (typeof SETUP_STEPS)[number];
export type AgentPath = 'A' | 'B' | 'C' | 'mock';

const COLUMNS = {
  id: agents.id,
  userId: agents.userId,
  level: agents.level,
  status: agents.status,
  walletAddress: agents.walletAddress,
  onchainAgentId: agents.onchainAgentId,
  ownerAddress: agents.ownerAddress,
  dragonName: agents.dragonName,
  dragonSpecies: agents.dragonSpecies,
  setupStep: agents.setupStep,
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
  activate(
    id: string,
    limit: { id: string; level: AgentLevel; aokrw: string; txHash: string; at: number },
  ): void {
    this.handle.sqlite.transaction(() => {
      this.handle.db
        .insert(agentLimitHistory)
        .values({
          id: limit.id,
          agentId: id,
          level: limit.level,
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
}
