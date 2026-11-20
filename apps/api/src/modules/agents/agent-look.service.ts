import { Injectable } from '@nestjs/common';
import { AppError, type PatchAgentBody, type PatchAgentResult } from '@sikyeoyong/shared';
import { AgentsRepository } from './agents.repository.js';

/**
 * Look (user-flow 18, D-32): the owner changes the dragon's species. Only `dragon_species`
 * changes. Nothing goes on chain, and the name, wallet, limits and 8004 registration stay as
 * they are. Allowed while frozen too: it moves no money.
 */
@Injectable()
export class AgentLookService {
  constructor(private readonly repo: AgentsRepository) {}

  /** Another user's id and an unknown id are both NOT_FOUND, never FORBIDDEN (no existence leak). */
  change(userId: string, agentId: string, body: PatchAgentBody): PatchAgentResult {
    const row = this.repo.findByUserId(userId);
    if (row === undefined || row.id !== agentId) {
      throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    }
    if (row.dragonSpecies !== body.dragonSpecies) {
      this.repo.setSpecies(row.id, body.dragonSpecies);
    }
    return { dragonSpecies: body.dragonSpecies };
  }
}
