import { Inject, Injectable, Logger } from '@nestjs/common';
import { aokrwToString, type OwnerAuthority, type PaymentProvider } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER, runOwnerAction } from '../payment/payment.service.js';
import { AgentsRepository } from './agents.repository.js';

/**
 * Hatching (user-flow 4, payment.md): create the wallet and wait for the 8004
 * registration, then, as the owner, bind the agent to the contract and write
 * the TransferLimit, and only then mark the agent ACTIVE (payment.md MUST
 * "TransferLimit 먼저"). Owner work goes through OwnerAuthority (D-24), so this
 * code does not know whether the operator (custodial) or the user's wallet
 * (pouch) signs. Each step is saved; a failure parks the agent at `failed`.
 */
@Injectable()
export class AgentSetupService {
  private readonly logger = new Logger(AgentSetupService.name);
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    private readonly repo: AgentsRepository,
  ) {}

  /** Starts (or joins) the setup of one agent. Never throws: failures land in setup_step. */
  run(agentId: string): Promise<void> {
    const current = this.running.get(agentId);
    if (current !== undefined) return current;
    const job = this.steps(agentId).finally(() => this.running.delete(agentId));
    this.running.set(agentId, job);
    return job;
  }

  private async steps(agentId: string): Promise<void> {
    const agent = this.repo.findById(agentId);
    if (agent === undefined || agent.status !== 'PENDING') return;
    try {
      let wallet = agent.walletAddress;
      let owner = agent.ownerAddress;
      if (wallet === null || owner === null) {
        this.repo.setStep(agentId, 'wallet');
        const created = await this.payment.createAgent({
          userId: agent.userId,
          name: agent.dragonName,
        });
        this.repo.saveWallet(agentId, {
          address: created.address,
          onchainAgentId:
            created.onchainAgentId === undefined ? null : created.onchainAgentId.toString(),
          ownerAddress: created.ownerAddress,
        });
        wallet = created.address;
        owner = created.ownerAddress;
      }
      this.repo.setStep(agentId, 'limit');
      const amount = this.config.policy.perOrderLimitAokrw[agent.level];
      const wallet_ = {
        agentRowId: agentId,
        address: wallet as `0x${string}`,
        ownerAddress: owner as `0x${string}`,
      };
      const bound = await runOwnerAction(this.owner, { kind: 'bind', agent: wallet_ });
      const limited = await runOwnerAction(this.owner, {
        kind: 'setTransferLimit',
        agent: wallet_,
        amount,
      });
      if (!bound.done || !limited.done) {
        // The user's wallet must sign (pouch). Hatching waits for that confirm; not wired before Q-30.
        throw new Error('owner signature needed before the agent can be ACTIVE');
      }
      const txHash = limited.txHashes[0] ?? '';
      this.repo.activate(agentId, {
        id: uuidv7(),
        level: agent.level,
        aokrw: aokrwToString(amount),
        txHash,
        at: Date.now(),
      });
    } catch (err) {
      this.logger.error(
        `agent setup failed for ${agentId}`,
        err instanceof Error ? err.stack : undefined,
      );
      this.repo.setStep(agentId, 'failed');
    }
  }
}
