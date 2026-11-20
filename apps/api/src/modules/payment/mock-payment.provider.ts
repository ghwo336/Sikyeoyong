import { createHash } from 'node:crypto';
import {
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
    this.wallet(agent.address).limit = amount;
    return Promise.resolve(this.tx());
  }

  fund(agent: AgentWallet, amount: bigint): Promise<Hex> {
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
    const error = this.refusal(req);
    return Promise.resolve(error === null ? { ok: true } : { ok: false, error });
  }

  pay(req: PayRequest): Promise<PayResult> {
    if (this.paid.has(req.orderRef)) {
      // OrderExists(orderRef): the contract pays an orderRef once (D-19).
      return Promise.resolve({ ok: false, stage: 'execution', error: { code: 'CONFLICT' } });
    }
    const error = this.refusal(req);
    if (error !== null) return Promise.resolve({ ok: false, stage: 'execution', error });
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

  /** Same order of checks as the proxy hooks: pause, TransferLimit, 30-day volume, balance. */
  private refusal(req: PayRequest): DecodedChainError | null {
    const w = this.wallets.get(req.agent.address);
    if (w === undefined || w.limit === null) return { code: 'CHAIN_AGENT_LIMIT_UNSET' };
    if (w.paused) return { code: 'CHAIN_AGENT_PAUSED' };
    if (req.amount > w.limit)
      return { code: 'CHAIN_AGENT_LIMIT', params: { max: formatOkrw(w.limit) } };
    this.rollWindow(w);
    const used = w.window?.used ?? 0n;
    if (used + req.amount > this.policy.periodicCapAokrw) {
      const resetMs = (w.window?.start ?? this.now()) + this.policy.periodicPeriodSec * 1000;
      return { code: 'CHAIN_PERIODIC_LIMIT', params: { resetAt: formatKstDateTime(resetMs) } };
    }
    if (w.balance < req.amount) return { code: 'CHAIN_INSUFFICIENT_FUNDS' };
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
