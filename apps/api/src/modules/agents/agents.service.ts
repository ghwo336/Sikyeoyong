import { Injectable } from '@nestjs/common';
import { AppError, type AgentLevel } from '@sikyeoyong/shared';
import { AgentsRepository } from './agents.repository.js';

export interface AgentSummary {
  readonly id: string;
  readonly level: AgentLevel;
  /** FROZEN by the owner or the operator; nothing is paid while frozen. */
  readonly frozen: boolean;
}

/** The user's dragon (one per user). Other modules read agents only through this service. */
@Injectable()
export class AgentsService {
  constructor(private readonly repo: AgentsRepository) {}

  getForUser(userId: string): AgentSummary {
    const row = this.repo.findByUserId(userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    return { id: row.id, level: row.level, frozen: row.status === 'FROZEN' };
  }
}
