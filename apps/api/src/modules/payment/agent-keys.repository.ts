import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { agentKeys } from '../../db/schema/index.js';
import type { AgentKeyStore, SealedKeyRow } from './agent-key-vault.js';

/** The payment module's own table: sealed path B keys (agent_keys) and nothing else. */
@Injectable()
export class AgentKeysRepository implements AgentKeyStore {
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
}
