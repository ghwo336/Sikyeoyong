import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { agentKeys } from '../../db/schema/index.js';
import type { AgentKeyStore, SealedKeyRow } from './agent-key-vault.js';
import type { RotatableKeyStore, ResealedFields } from './agent-key-rotation.js';

/** The payment module's own table: sealed path B keys (agent_keys) and nothing else. */
@Injectable()
export class AgentKeysRepository implements AgentKeyStore, RotatableKeyStore {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  insert(row: SealedKeyRow): void {
    this.handle.db.insert(agentKeys).values(row).run();
  }

  find(address: string): SealedKeyRow | undefined {
    return this.handle.db.select().from(agentKeys).where(eq(agentKeys.address, address)).get();
  }

  findByAgentId(agentId: string): SealedKeyRow | undefined {
    return this.handle.db.select().from(agentKeys).where(eq(agentKeys.agentId, agentId)).get();
  }

  link(address: string, agentId: string): void {
    this.handle.db.update(agentKeys).set({ agentId }).where(eq(agentKeys.address, address)).run();
  }

  setOnchainAgentId(address: string, onchainAgentId: string): void {
    this.handle.db
      .update(agentKeys)
      .set({ onchainAgentId })
      .where(eq(agentKeys.address, address))
      .run();
  }

  list(): SealedKeyRow[] {
    return this.handle.db.select().from(agentKeys).all();
  }

  /**
   * Swaps the seal of one row in one transaction, only if the row still holds the seal that was
   * read (so a concurrent change is never overwritten). False when the row moved on.
   */
  reseal(old: SealedKeyRow, next: ResealedFields): boolean {
    return this.handle.db.transaction((tx) => {
      const changed = tx
        .update(agentKeys)
        .set(next)
        .where(
          and(
            eq(agentKeys.address, old.address),
            eq(agentKeys.ciphertext, old.ciphertext),
            eq(agentKeys.iv, old.iv),
            eq(agentKeys.tag, old.tag),
          ),
        )
        .run().changes;
      return changed === 1;
    });
  }
}
