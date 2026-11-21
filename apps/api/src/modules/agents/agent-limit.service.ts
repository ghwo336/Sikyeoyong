import { Inject, Injectable } from '@nestjs/common';
import { AppError, aokrwToString, type OwnerAuthority, parseAokrw } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { OWNER_AUTHORITY, runOwnerAction } from '../payment/payment.service.js';
import { agentWalletOf } from './agent-wallet.js';
import { AgentsRepository } from './agents.repository.js';

/** The dragon as a limit change sees it. */
export interface LimitAgent {
  readonly id: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'FROZEN' | 'REVOKED';
  readonly perOrderLimitAokrw: bigint;
}

/**
 * The per-order limit on the chain (D-31, D-28): the 8004 TransferLimit is written first
 * through the owner port; only then the stored amount changes, so the app never says a limit
 * the chain does not hold. Range, step, re-auth and the lock are the caller's (LimitsService);
 * the caller holds AgentLock for this dragon while it calls write.
 */
@Injectable()
export class AgentLimitService {
  constructor(
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    private readonly repo: AgentsRepository,
  ) {}

  /** The user's dragon with its stored per-order limit. NOT_FOUND before naming. */
  find(userId: string): LimitAgent {
    const agent = this.repo.findByUserId(userId);
    if (agent === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    return {
      id: agent.id,
      status: agent.status,
      perOrderLimitAokrw: parseAokrw(agent.perOrderLimitAokrw),
    };
  }

  /**
   * Writes the TransferLimit and then the amount and its history. Only a hatched, unfrozen
   * dragon: frozen is SERVER_FROZEN, not hatched is CHAIN_AGENT_LIMIT_UNSET. Returns the tx hash.
   */
  async write(userId: string, amount: bigint, nowMs: number): Promise<`0x${string}` | null> {
    const agent = this.repo.findByUserId(userId);
    if (agent === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    if (agent.status === 'FROZEN') {
      throw new AppError('SERVER_FROZEN', { reason: 'agent is frozen' });
    }
    if (agent.status !== 'ACTIVE') {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'not hatched yet' });
    }
    if (agent.walletAddress === null || agent.ownerAddress === null) {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'agent wallet not ready' });
    }
    const written = await runOwnerAction(this.owner, {
      kind: 'setTransferLimit',
      agent: agentWalletOf(agent),
      amount,
    });
    if (!written.done) {
      throw new AppError('INTERNAL', { reason: 'owner signature needed for the TransferLimit' });
    }
    const txHash = written.txHashes[0] ?? null;
    this.repo.changePerOrderLimit(agent.id, {
      id: uuidv7(nowMs),
      aokrw: aokrwToString(amount),
      txHash,
      at: nowMs,
    });
    return txHash;
  }
}
