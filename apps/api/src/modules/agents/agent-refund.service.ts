import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  aokrwToString,
  type AgentWallet,
  type OwnerAuthority,
  type PaymentProvider,
  type RefundResult,
} from '@sikyeoyong/shared';
import { AllowanceService } from '../allowance/allowance.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER, runOwnerAction } from '../payment/payment.service.js';
import { AgentLock } from './agent-lock.service.js';
import { agentWalletOf } from './agent-wallet.js';
import { AgentsRepository } from './agents.repository.js';

/**
 * POST /agents/me/drain (user-flow 17, Frozen.dc.html "돌려받기"): what is left in the
 * dragon's pocket goes back to the owner (drain through the owner port, D-24), and the owner
 * allowance ledger records what actually moved. The owner's button only, never an LLM tool.
 * - Only while frozen: a frozen dragon cannot confirm orders (SERVER_FROZEN), so no payment or
 *   top-up moves the pocket while it drains.
 * - One owner action at a time per dragon (AgentLock, shared with freeze and unfreeze): two presses
 *   together cannot both record, and an unfreeze cannot slip in while the pocket drains.
 * - The ledger gets the measured difference (before minus after the drain), never the request.
 * No automatic retry (CLAUDE.md 9): a failed drain records nothing and the owner presses again.
 */
@Injectable()
export class AgentRefundService {
  constructor(
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    private readonly allowance: AllowanceService,
    private readonly repo: AgentsRepository,
    private readonly lock: AgentLock,
  ) {}

  refund(userId: string): Promise<RefundResult> {
    const first = this.repo.findByUserId(userId);
    if (first === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    // Read again inside the turn: a press that waited finds the pocket already empty.
    return this.lock.run(first.id, () => {
      const agent = this.repo.findByUserId(userId);
      if (agent === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
      if (agent.status !== 'FROZEN') {
        throw new AppError('CONFLICT', { reason: 'refund only while the dragon is frozen' });
      }
      if (agent.walletAddress === null || agent.ownerAddress === null) {
        throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'agent wallet not ready' });
      }
      return this.drain(userId, agentWalletOf(agent));
    });
  }

  private async drain(userId: string, wallet: AgentWallet): Promise<RefundResult> {
    const before = await this.payment.balanceOf(wallet.address);
    if (before === 0n) return { refunded: '0', txHashes: [] };
    const written = await runOwnerAction(this.owner, { kind: 'drain', agent: wallet });
    if (!written.done) {
      throw new AppError('INTERNAL', { reason: 'owner signature needed for the refund' });
    }
    const after = await this.payment.balanceOf(wallet.address);
    const moved = before > after ? before - after : 0n;
    if (moved > 0n) {
      this.allowance.record(userId, 'refund', moved, written.txHashes[0] ?? null);
    }
    return { refunded: aokrwToString(moved), txHashes: written.txHashes };
  }
}
