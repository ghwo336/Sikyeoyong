import { Inject, Injectable, Logger } from '@nestjs/common';
import { aokrwToString, type PaymentProvider } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { AgentsRepository } from './agents.repository.js';

/**
 * Hatching (user-flow 4, payment.md): create the wallet and wait for the 8004
 * registration, then write the TransferLimit, and only then mark the agent
 * ACTIVE (payment.md MUST "TransferLimit 먼저"). Each step is saved so the
 * screen can show it; a failure parks the agent at `failed` for a retry.
 */
@Injectable()
export class AgentSetupService {
  private readonly logger = new Logger(AgentSetupService.name);
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
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
      const txHash = await this.payment.setTransferLimit(
        {
          agentRowId: agentId,
          address: wallet as `0x${string}`,
          ownerAddress: owner as `0x${string}`,
        },
        amount,
      );
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
