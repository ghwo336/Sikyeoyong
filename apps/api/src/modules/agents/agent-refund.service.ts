import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  aokrwToString,
  type OwnerAuthority,
  type PaymentProvider,
  type RefundResult,
} from '@sikyeoyong/shared';
import { AllowanceService } from '../allowance/allowance.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER, runOwnerAction } from '../payment/payment.service.js';
import { AgentsRepository } from './agents.repository.js';

/**
 * POST /agents/me/drain (user-flow 17, Frozen.dc.html "돌려받기"): what is left in the
 * dragon's pocket goes back to the owner (drain through the owner port, D-24), and the owner
 * allowance ledger records what actually moved. The owner's button only, never an LLM tool.
 * - Only while frozen: a frozen dragon cannot confirm orders (SERVER_FROZEN), so no payment or
 *   top-up moves the pocket while it drains.
 * - One refund at a time per dragon (this process): two presses together cannot both record.
 * - The ledger gets the measured difference (before minus after the drain), never the request.
 * No automatic retry (CLAUDE.md 9): a failed drain records nothing and the owner presses again.
 */
@Injectable()
export class AgentRefundService {
  private readonly running = new Map<string, Promise<RefundResult>>();

  constructor(
    @Inject(OWNER_AUTHORITY) private readonly owner: OwnerAuthority,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    private readonly allowance: AllowanceService,
    private readonly repo: AgentsRepository,
  ) {}

  async refund(userId: string): Promise<RefundResult> {
    const agent = this.repo.findByUserId(userId);
    if (agent === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    if (agent.status !== 'FROZEN') {
      throw new AppError('CONFLICT', { reason: 'refund only while the dragon is frozen' });
    }
    if (agent.walletAddress === null || agent.ownerAddress === null) {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'agent wallet not ready' });
    }
    const wallet = {
      agentRowId: agent.id,
      address: agent.walletAddress as `0x${string}`,
      ownerAddress: agent.ownerAddress as `0x${string}`,
    };
    // A press while one is running waits for it and gets nothing new (the pocket is empty after).
    const inFlight = this.running.get(agent.id);
    if (inFlight !== undefined) {
      await inFlight.catch(() => undefined);
      return { refunded: '0', txHashes: [] };
    }
    const run = this.drain(userId, wallet);
    this.running.set(agent.id, run);
    try {
      return await run;
    } finally {
      this.running.delete(agent.id);
    }
  }

  private async drain(
    userId: string,
    wallet: { agentRowId: string; address: `0x${string}`; ownerAddress: `0x${string}` },
  ): Promise<RefundResult> {
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
