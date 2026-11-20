import { createHash } from 'node:crypto';
import {
  AppError,
  type AgentWallet,
  type DecodedChainError,
  formatKstDateTime,
  formatOkrw,
  type Hex,
  type PayRequest,
  type PayResult,
  type PaymentProvider,
  type PolicyConfig,
} from '@sikyeoyong/shared';

interface MockWallet {
  balance: bigint;
  limit: bigint | null;
  paused: boolean;
  /** Fixed 30-day window that starts with the first order (maroo-facts 3.2, (추론)). */
  window: { readonly start: number; used: bigint } | null;
}

function badAmount(reason: string): AppError {
  return new AppError('INTERNAL', { reason });
}

function hex(seed: string, bytes: number): Hex {
  return `0x${createHash('sha256')
    .update(seed)
    .digest('hex')
    .slice(0, bytes * 2)}`;
}

/** The owner of every mock agent, like the operator account in phase 1 (tech-spec 2.3). Made up, not a chain address. */
export const MOCK_OPERATOR: Hex = hex('mock-operator', 20);

/**
 * In-memory stand-in for the chain, for development and tests only
 * (PAYMENT_PATH=mock, refused in production). It refuses an order for the same
 * reasons and with the same error codes as the chain-and-pcl.md revert table,
 * so orders, confirm and the dragon's words can be built and tested before the
 * contract is deployed. It never claims anything happened on a real chain.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly path = 'mock' as const;
  private readonly wallets = new Map<Hex, MockWallet>();
  private readonly paid = new Map<Hex, { txHash: Hex; blockNumber: bigint }>();
  private agents = 0n;
  private block = 0n;
  private txs = 0;

  constructor(
    private readonly policy: PolicyConfig,
    private readonly now: () => number = Date.now,
  ) {}

  createAgent(input: { readonly userId: string; readonly name: string }): Promise<AgentWallet> {
    const address = hex(`agent:${input.userId}`, 20);
    if (!this.wallets.has(address)) {
      this.wallets.set(address, { balance: 0n, limit: null, paused: false, window: null });
    }
    this.agents += 1n;
    return Promise.resolve({
      agentRowId: '',
      address,
      onchainAgentId: this.agents,
      ownerAddress: MOCK_OPERATOR,
    });
  }

  setTransferLimit(agent: AgentWallet, amount: bigint): Promise<Hex> {
    if (amount <= 0n) return Promise.reject(badAmount('TransferLimit must be positive'));
    this.wallet(agent.address).limit = amount;
    return Promise.resolve(this.tx());
  }

  fund(agent: AgentWallet, amount: bigint): Promise<Hex> {
    if (amount <= 0n) return Promise.reject(badAmount('fund amount must be positive'));
    this.wallet(agent.address).balance += amount;
    return Promise.resolve(this.tx());
  }

  drain(agent: AgentWallet): Promise<Hex[]> {
    this.wallet(agent.address).balance = 0n;
    return Promise.resolve([this.tx()]);
  }

  freeze(agent: AgentWallet): Promise<Hex[]> {
    this.wallet(agent.address).paused = true;
    return Promise.resolve([this.tx()]);
  }

  unfreeze(agent: AgentWallet): Promise<Hex[]> {
    this.wallet(agent.address).paused = false;
    return Promise.resolve([this.tx()]);
  }

  preflight(req: PayRequest): Promise<{ ok: true } | { ok: false; error: DecodedChainError }> {
    const refused = this.refusal(req);
    return Promise.resolve(refused === null ? { ok: true } : { ok: false, error: refused.error });
  }

  pay(req: PayRequest): Promise<PayResult> {
    const refused = this.refusal(req);
    if (refused !== null)
      return Promise.resolve({ ok: false, stage: refused.stage, error: refused.error });
    const w = this.wallet(req.agent.address);
    w.balance -= req.amount;
    const start = w.window?.start ?? this.now();
    w.window = { start, used: (w.window?.used ?? 0n) + req.amount };
    this.block += 1n;
    const done = { txHash: this.tx(), blockNumber: this.block };
    this.paid.set(req.orderRef, done);
    return Promise.resolve({ ok: true, ...done });
  }

  findPaid(orderRef: Hex): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    return Promise.resolve(this.paid.get(orderRef) ?? null);
  }

  balanceOf(address: Hex): Promise<bigint> {
    return Promise.resolve(this.wallets.get(address)?.balance ?? 0n);
  }

  /**
   * The order a real payment would fail in (추론, payment.md mock 절):
   * 1. submit: an amount the wallet cannot send (0 or negative is the contract's
   *    BadAmount; a short balance fails before execution);
   * 2. proxy preCall (PCL): TransferLimit unset, per-order limit, 30-day volume;
   * 3. contract body: OrderExists(orderRef), AgentIsPaused.
   * Codes follow the chain-and-pcl.md revert table; anything not in it is INTERNAL.
   */
  private refusal(
    req: PayRequest,
  ): { stage: 'submit' | 'execution'; error: DecodedChainError } | null {
    if (req.amount <= 0n) return { stage: 'execution', error: { code: 'INTERNAL' } };
    const w = this.wallets.get(req.agent.address);
    if ((w?.balance ?? 0n) < req.amount) {
      return { stage: 'submit', error: { code: 'CHAIN_INSUFFICIENT_FUNDS' } };
    }
    if (w === undefined || w.limit === null) {
      return { stage: 'execution', error: { code: 'CHAIN_AGENT_LIMIT_UNSET' } };
    }
    if (req.amount > w.limit) {
      return {
        stage: 'execution',
        error: { code: 'CHAIN_AGENT_LIMIT', params: { max: formatOkrw(w.limit) } },
      };
    }
    this.rollWindow(w);
    const used = w.window?.used ?? 0n;
    if (used + req.amount > this.policy.periodicCapAokrw) {
      // A window opens with the first order; with none yet, this order would open it now.
      const resetMs = (w.window?.start ?? this.now()) + this.policy.periodicPeriodSec * 1000;
      return {
        stage: 'execution',
        error: { code: 'CHAIN_PERIODIC_LIMIT', params: { resetAt: formatKstDateTime(resetMs) } },
      };
    }
    // OrderExists is not in the revert table, so it is INTERNAL; confirm asks findPaid first (D-19).
    if (this.paid.has(req.orderRef)) return { stage: 'execution', error: { code: 'INTERNAL' } };
    if (w.paused) return { stage: 'execution', error: { code: 'CHAIN_AGENT_PAUSED' } };
    return null;
  }

  private rollWindow(w: MockWallet): void {
    if (w.window !== null && this.now() >= w.window.start + this.policy.periodicPeriodSec * 1000) {
      w.window = null;
    }
  }

  private wallet(address: Hex): MockWallet {
    let w = this.wallets.get(address);
    if (w === undefined) {
      w = { balance: 0n, limit: null, paused: false, window: null };
      this.wallets.set(address, w);
    }
    return w;
  }

  private tx(): Hex {
    this.txs += 1;
    return hex(`tx:${String(this.txs)}`, 32);
  }
}
