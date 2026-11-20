import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  type AgentLevel,
  type AgentWallet,
  type AgentSetupView,
  type CreateAgentBody,
  type DragonSpecies,
  type PaymentProvider,
} from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { IdentityService } from '../identity/identity.service.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { AgentSetupService } from './agent-setup.service.js';
import { AgentsRepository } from './agents.repository.js';

export interface AgentSummary {
  readonly id: string;
  readonly level: AgentLevel;
  /** FROZEN by the owner or the operator; nothing is paid while frozen. */
  readonly frozen: boolean;
  /** Hatched: the TransferLimit is written (ACTIVE or FROZEN). Orders wait until then (user-flow 4). */
  readonly ready: boolean;
  /** Agent wallet, null until the wallet is created (status PENDING). */
  readonly wallet: `0x${string}` | null;
  readonly dragonName: string;
  readonly dragonSpecies: DragonSpecies;
  /** When the owner asked for this dragon (unix ms): the ID card's birth date. */
  readonly bornAt: number;
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
  constructor(
    private readonly repo: AgentsRepository,
    private readonly setup: AgentSetupService,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
    private readonly identity: IdentityService,
  ) {}

  getForUser(userId: string): AgentSummary {
    const row = this.repo.findByUserId(userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    return {
      id: row.id,
      level: row.level,
      frozen: row.status === 'FROZEN',
      ready: row.status === 'ACTIVE' || row.status === 'FROZEN',
      wallet: asWallet(row.walletAddress),
      dragonName: row.dragonName,
      dragonSpecies: row.dragonSpecies,
      bornAt: row.createdAt,
    };
  }

  /**
   * The wallet the payment path pays from. Before hatching wrote the wallet and
   * its owner, ordering is CHAIN_AGENT_LIMIT_UNSET (user-flow 4).
   */
  walletForPayment(userId: string): AgentWallet {
    const row = this.repo.findByUserId(userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    const address = asWallet(row.walletAddress);
    const owner = asWallet(row.ownerAddress);
    if (address === null || owner === null) {
      throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'agent wallet not ready' });
    }
    return {
      agentRowId: row.id,
      address,
      ownerAddress: owner,
      ...(row.onchainAgentId === null ? {} : { onchainAgentId: BigInt(row.onchainAgentId) }),
    };
  }

  /** POST /agents: one dragon per user, created PENDING; hatching runs in the background. */
  create(
    userId: string,
    body: CreateAgentBody,
    nowMs: number = Date.now(),
  ): { agent: { id: string; status: 'PENDING' } } {
    // D-16: no identity check, no dragon.
    if (!this.identity.isVerified(userId)) {
      throw new AppError('FORBIDDEN', { reason: 'identity check needed before hatching' });
    }
    if (this.repo.findByUserId(userId) !== undefined) {
      throw new AppError('CONFLICT', { reason: 'the user already has a dragon' });
    }
    const id = uuidv7(nowMs);
    try {
      this.repo.insert({
        id,
        userId,
        dragonName: body.dragonName,
        dragonSpecies: body.dragonSpecies,
        paymentPath: this.payment.path,
        createdAt: nowMs,
      });
    } catch {
      // Lost a race with another create for the same user.
      throw new AppError('CONFLICT', { reason: 'the user already has a dragon' });
    }
    void this.setup.run(id);
    return { agent: { id, status: 'PENDING' } };
  }

  /** GET /agents/me: where hatching is (user-flow 4). */
  setupView(userId: string): AgentSetupView {
    const row = this.repo.findByUserId(userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    const steps = (wallet: S, identity: S, limit: S): AgentSetupView['steps'] => [
      { key: 'wallet', status: wallet },
      { key: 'identity', status: identity },
      { key: 'limit', status: limit },
    ];
    switch (row.setupStep) {
      case 'wallet':
        return { status: 'PENDING', steps: steps('doing', 'waiting', 'waiting') };
      case 'identity':
        return { status: 'PENDING', steps: steps('done', 'doing', 'waiting') };
      case 'limit':
        return { status: 'PENDING', steps: steps('done', 'done', 'doing') };
      case 'done':
        return { status: 'ACTIVE', steps: steps('done', 'done', 'done') };
      case 'failed':
        return row.walletAddress === null
          ? { status: 'FAILED', steps: steps('failed', 'waiting', 'waiting') }
          : { status: 'FAILED', steps: steps('done', 'done', 'failed') };
    }
  }

  /** "다시 깨우기": only a failed setup restarts, from where it stopped. */
  retrySetup(userId: string): AgentSetupView {
    const row = this.repo.findByUserId(userId);
    if (row === undefined) throw new AppError('NOT_FOUND', { reason: 'agent not found' });
    if (row.setupStep === 'failed') {
      this.repo.setStep(row.id, row.walletAddress === null ? 'wallet' : 'limit');
      void this.setup.run(row.id);
    }
    return this.setupView(userId);
  }
}

type S = AgentSetupView['steps'][number]['status'];
