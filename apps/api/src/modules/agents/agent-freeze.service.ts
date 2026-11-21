import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  type AgentWallet,
  type FreezeResult,
  type OwnerAuthority,
} from '@sikyeoyong/shared';
import { OWNER_AUTHORITY, runOwnerAction } from '../payment/payment.service.js';
import { AgentLock } from './agent-lock.service.js';
import { agentWalletOf } from './agent-wallet.js';
import { AgentsRepository } from './agents.repository.js';

/**
 * The kill switch (user-flow 17, tech-spec 9.3): POST /agents/me/freeze and /unfreeze, the
 * owner's button only (never an LLM tool). Two layers, ordered so a failure halfway always
 * leaves the safe side:
 * - freeze: the server flag first (orders stop at once, SERVER_FROZEN), then the chain pause
 *   (setAgentPaused through the owner port, so a leaked agent key cannot place an order through
 *   the contract either; float sent outside the order path is not covered, D-06). If the
 *   chain call fails the dragon stays frozen on the server and the owner presses again.
 * - unfreeze: the chain resume first, then the server flag. If the chain call fails the
 *   dragon stays frozen everywhere.
 * Pressing freeze on a frozen dragon sends the chain pause again (the owner's retry after a
 * failed chain call; never automatic, CLAUDE.md 9). Unfreeze on an active dragon is a no-op.
 * Freeze, unfreeze and drain of one dragon run one at a time (AgentLock), and each reads the
 * status inside its turn, so a slow unfreeze cannot finish after a later freeze.
 */
@Injectable()
export class AgentFreezeService {
  constructor(
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    private readonly repo: AgentsRepository,
    private readonly lock: AgentLock,
  ) {}

  freeze(userId: string): Promise<FreezeResult> {
    return this.lock.run(this.ready(userId).id, async () => {
      const agent = this.ready(userId);
      if (agent.status === 'ACTIVE' && !this.repo.changeStatus(agent.id, 'ACTIVE', 'FROZEN')) {
        throw new AppError('CONFLICT', { reason: 'agent status changed while freezing' });
      }
      const txHashes = await this.chain(agent, 'pause');
      return { frozen: true, txHashes };
    });
  }

  unfreeze(userId: string): Promise<FreezeResult> {
    return this.lock.run(this.ready(userId).id, async () => {
      const agent = this.ready(userId);
      if (agent.status === 'ACTIVE') return { frozen: false, txHashes: [] };
      const txHashes = await this.chain(agent, 'unpause');
      if (!this.repo.changeStatus(agent.id, 'FROZEN', 'ACTIVE')) {
        throw new AppError('CONFLICT', { reason: 'agent status changed while waking' });
      }
      return { frozen: false, txHashes };
    });
  }

  private ready(userId: string) {
    const agent = this.repo.findByUserId(userId);
    if (agent === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    if (agent.status !== 'ACTIVE' && agent.status !== 'FROZEN') {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'not hatched yet' });
    }
    return { id: agent.id, status: agent.status, wallet: agentWalletOf(agent) };
  }

  private async chain(
    agent: { wallet: AgentWallet },
    kind: 'pause' | 'unpause',
  ): Promise<`0x${string}`[]> {
    const written = await runOwnerAction(this.owner, { kind, agent: agent.wallet });
    if (!written.done) {
      throw new AppError('INTERNAL', { reason: `owner signature needed for ${kind}` });
    }
    return written.txHashes;
  }
}
