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
  type ReceiptOutcome,
} from '@sikyeoyong/shared';

interface MockWallet {
  balance: bigint;
  limit: bigint | null;
  paused: boolean;
  /** Window start is a unix multiple of the period, not the first order time (maroo-facts 3.2, confirmed at 3,600 s only). */
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

/** What the mock chain forgot at a restart, rebuilt from the database (mock-chain-state.repository.ts). */
export interface MockChainSnapshot {
  readonly wallets: readonly {
    readonly address: Hex;
    readonly limit: bigint | null;
    readonly paused: boolean;
    /** Float in the pocket: allowance funded minus refunded minus paid, never below 0. */
    readonly balance: bigint;
  }[];
  /** Orders already paid, oldest first, with the wallet that paid and the quote time (ms). */
  readonly paid: readonly {
    readonly address: Hex;
    readonly orderRef: Hex;
    readonly txHash: Hex;
    readonly amount: bigint;
    readonly atMs: number;
  }[];
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
  /** Like path B's gas share: the pocket is topped up with it and it stays after an order (0: none). */
  readonly gasReserveAokrw: bigint;

  constructor(
    private readonly policy: PolicyConfig,
    private readonly now: () => number = Date.now,
    gasReserveAokrw: bigint = 0n,
  ) {
    this.gasReserveAokrw = gasReserveAokrw;
  }

  /**
   * Development only: puts back what a process restart wiped (wallets, limits, paused flags,
   * float, paid orders and the 30-day window that holds now). The database is the memory.
   */
  restore(snapshot: MockChainSnapshot): void {
    for (const s of snapshot.wallets) {
      const w = this.wallet(s.address);
      w.limit = s.limit;
      w.paused = s.paused;
      w.balance = s.balance;
    }
    const start = this.windowStartMs();
    for (const o of snapshot.paid) {
      this.block += 1n;
      this.paid.set(o.orderRef, { txHash: o.txHash, blockNumber: this.block });
      if (o.atMs < start) continue;
      const w = this.wallet(o.address);
      w.window = { start, used: (w.window?.used ?? 0n) + o.amount };
    }
  }

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

  /** Recorded only: the mock does not refuse unbound agents (AgentNotBound is outside the revert table). */
  bindAgent(agent: AgentWallet): Promise<Hex> {
    this.wallet(agent.address);
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
    const start = w.window?.start ?? this.windowStartMs();
    w.window = { start, used: (w.window?.used ?? 0n) + req.amount };
    this.block += 1n;
    const done = { txHash: this.tx(), blockNumber: this.block };
    this.paid.set(req.orderRef, done);
    return Promise.resolve({ ok: true, ...done });
  }

  findPaid(orderRef: Hex): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    return Promise.resolve(this.paid.get(orderRef) ?? null);
  }

  /**
   * The mock mines every payment at once and never leaves a reverted one on chain (a refusal
   * returns no hash), so a hash is either a payment it made or unknown.
   */
  receiptOf(txHash: Hex): Promise<ReceiptOutcome> {
    for (const done of this.paid.values()) {
      if (done.txHash === txHash) {
        return Promise.resolve({ status: 'success', blockNumber: done.blockNumber });
      }
    }
    return Promise.resolve({ status: 'unknown' });
  }

  balanceOf(address: Hex): Promise<bigint> {
    return Promise.resolve(this.wallets.get(address)?.balance ?? 0n);
  }

  /**
   * The order a real payment fails in:
   * 1. submit: the wallet cannot cover msg.value, so nothing executes;
   * 2. proxy preCall (PCL, before the body runs; (추론) from maroo-facts 3.5 preCall):
   *    TransferLimit unset, per-order limit, 30-day volume;
   * 3. contract body, in tech-spec 5.2 placeOrder order: AgentIsPaused, BadAmount
   *    (0 or less), OrderExists. AgentNotBound and MerchantNotActive are not simulated.
   * Codes follow the chain-and-pcl.md revert table; BadAmount is not in it, so it is INTERNAL.
   * OrderExists is CHAIN_ORDER_EXISTS (confirm asks findPaid and settles it as paid).
   */
  private refusal(
    req: PayRequest,
  ): { stage: 'submit' | 'execution'; error: DecodedChainError } | null {
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
      // With no window yet, this order would open the one that holds now.
      const resetMs =
        (w.window?.start ?? this.windowStartMs()) + this.policy.periodicPeriodSec * 1000;
      return {
        stage: 'execution',
        error: { code: 'CHAIN_PERIODIC_LIMIT', params: { resetAt: formatKstDateTime(resetMs) } },
      };
    }
    if (w.paused) return { stage: 'execution', error: { code: 'CHAIN_AGENT_PAUSED' } };
    if (req.amount <= 0n) return { stage: 'execution', error: { code: 'INTERNAL' } };
    if (this.paid.has(req.orderRef)) {
      return { stage: 'execution', error: { code: 'CHAIN_ORDER_EXISTS' } };
    }
    return null;
  }

  /**
   * The mock chain's periodic window for one agent (boundaries are unix multiples of the period) (what contractPeriodicVolume will answer on the
   * real chain): used aokrw and its reset in unix seconds, null before the first order.
   */
  periodicVolume(address: Hex): { usedAokrw: bigint; resetAtSec: number | null } {
    const w = this.wallet(address);
    this.rollWindow(w);
    if (w.window === null) return { usedAokrw: 0n, resetAtSec: null };
    return {
      usedAokrw: w.window.used,
      resetAtSec: Math.floor((w.window.start + this.policy.periodicPeriodSec * 1000) / 1000),
    };
  }

  /** Start of the window that holds now: floor(now / period) * period on unix time, in ms. */
  private windowStartMs(): number {
    const periodMs = this.policy.periodicPeriodSec * 1000;
    return Math.floor(this.now() / periodMs) * periodMs;
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
