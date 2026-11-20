import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  type AgentLevel,
  aokrwToString,
  type OwnerAuthority,
  type SetLevelResult,
} from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { OWNER_AUTHORITY, runOwnerAction } from '../payment/payment.service.js';
import { AgentsRepository } from './agents.repository.js';

/**
 * POST /agents/me/level (D-21, D-28): the owner's button, never an LLM tool. The chain's
 * TransferLimit is written first through the owner port; only then the level changes, so
 * the app never says a limit the chain does not hold. Lowering needs no re-auth. Raising
 * does: with REAUTH_MODE=none (testnet demo, refused in production) the button is enough;
 * with pouch the owner's wallet must sign, not wired before the Pouch SDK (Q-30).
 */
@Injectable()
export class AgentLevelService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    private readonly repo: AgentsRepository,
  ) {}

  async setLevel(
    userId: string,
    level: AgentLevel,
    nowMs: number = Date.now(),
  ): Promise<SetLevelResult> {
    const agent = this.repo.findByUserId(userId);
    if (agent === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    if (agent.status === 'FROZEN')
      throw new AppError('SERVER_FROZEN', { reason: 'agent is frozen' });
    if (agent.status !== 'ACTIVE') {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'not hatched yet' });
    }
    const amount = this.config.policy.perOrderLimitAokrw[level];
    if (level === agent.level) {
      return { level, perOrderLimit: aokrwToString(amount), txHash: null };
    }
    if (level > agent.level && this.config.reauthMode !== 'none') {
      throw new AppError('INTERNAL', {
        reason: 're-auth by the owner wallet is not wired yet (Q-30)',
      });
    }
    if (agent.walletAddress === null || agent.ownerAddress === null) {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'agent wallet not ready' });
    }
    const written = await runOwnerAction(this.owner, {
      kind: 'setTransferLimit',
      agent: {
        agentRowId: agent.id,
        address: agent.walletAddress as `0x${string}`,
        ownerAddress: agent.ownerAddress as `0x${string}`,
      },
      amount,
    });
    if (!written.done) {
      throw new AppError('INTERNAL', { reason: 'owner signature needed for the TransferLimit' });
    }
    const txHash = written.txHashes[0] ?? null;
    this.repo.changeLevel(agent.id, {
      id: uuidv7(nowMs),
      level,
      aokrw: aokrwToString(amount),
      txHash,
      at: nowMs,
    });
    return { level, perOrderLimit: aokrwToString(amount), txHash };
  }
}
