import { Injectable } from '@nestjs/common';
import { AppError, type AgentLevel, type DragonSpecies } from '@sikyeoyong/shared';
import { AgentsRepository } from './agents.repository.js';

export interface AgentSummary {
  readonly id: string;
  readonly level: AgentLevel;
  /** FROZEN by the owner or the operator; nothing is paid while frozen. */
  readonly frozen: boolean;
  /** Agent wallet, null until the wallet is created (status PENDING). */
  readonly wallet: `0x${string}` | null;
  readonly dragonName: string;
  readonly dragonSpecies: DragonSpecies;
}

function asWallet(value: string | null): `0x${string}` | null {
  if (value === null) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new AppError('INTERNAL', { reason: 'stored agent wallet is not an address' });
  }
  return value as `0x${string}`;
}

/** The user's dragon (one per user). Other modules read agents only through this service. */
@Injectable()
export class AgentsService {
  constructor(private readonly repo: AgentsRepository) {}

  getForUser(userId: string): AgentSummary {
    const row = this.repo.findByUserId(userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    return {
      id: row.id,
      level: row.level,
      frozen: row.status === 'FROZEN',
      wallet: asWallet(row.walletAddress),
      dragonName: row.dragonName,
      dragonSpecies: row.dragonSpecies,
    };
  }
}
