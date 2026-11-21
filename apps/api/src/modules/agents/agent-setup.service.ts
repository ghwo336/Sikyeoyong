import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  type OwnerAuthority,
  parseAokrw,
  type PaymentProvider,
} from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER, runOwnerAction } from '../payment/payment.service.js';
import { agentWalletOf } from './agent-wallet.js';
import { AgentsRepository } from './agents.repository.js';

const SECRET_KEY = /key|secret|token|seed|mnemonic|password/i;

/** The AppError code and its detail (reason, tx hash...), with anything key-like left out. */
function describeFailure(err: unknown): string {
  if (!(err instanceof AppError)) return err instanceof Error ? err.message : 'unknown error';
  const detail = JSON.stringify(err.detail ?? null, (k, v: unknown) =>
    SECRET_KEY.test(k) ? '[hidden]' : typeof v === 'bigint' ? v.toString() : v,
  );
  return `${err.code} ${detail}`;
}

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
      if (agent.walletAddress === null || agent.ownerAddress === null) {
        this.repo.setStep(agentId, 'wallet');
        const created = await this.payment.createAgent({
          userId: agent.userId,
          name: agent.dragonName,
          agentRowId: agentId,
        });
        this.repo.saveWallet(agentId, {
          address: created.address,
          onchainAgentId:
            created.onchainAgentId === undefined ? null : created.onchainAgentId.toString(),
          ownerAddress: created.ownerAddress,
        });
      }
      this.repo.setStep(agentId, 'limit');
      // The amount stored at creation: policy.perOrderLimit.initial (D-31). The owner changes it later.
      const amount = parseAokrw(agent.perOrderLimitAokrw);
      // Read back after saveWallet so the 8004 id the wallet step stored is included.
      const wallet_ = agentWalletOf(this.repo.findById(agentId) ?? agent);
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
      const txHash = limited.txHashes[0];
      if (txHash === undefined) throw new Error('TransferLimit write returned no transaction');
      this.repo.activate(agentId, {
        id: uuidv7(),
        aokrw: agent.perOrderLimitAokrw,
        txHash,
        at: Date.now(),
      });
    } catch (err) {
      this.logger.error(
        `agent setup failed for ${agentId} at ${this.repo.findById(agentId)?.setupStep ?? '?'}: ${describeFailure(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      this.repo.setStep(agentId, 'failed');
    }
  }
}
