import { identityRegistryAbi } from '@maroo-chain/viem';
import {
  AppError,
  logRanges,
  type AgentWallet,
  type DecodedChainError,
  type Hex,
  type PayRequest,
  type PayResult,
  type PaymentProvider,
  type ReceiptOutcome,
} from '@sikyeoyong/shared';
import {
  type Abi,
  type Account,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseEventLogs,
} from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { ordersAbi } from '../../common/onchain/orders-abi.js';
import {
  chainErrorOf,
  decodeChainFailure,
  decodeRevert,
  revertDataOf,
} from '../../common/onchain/revert-decoder.js';
import type { AgentKeyVault } from './agent-key-vault.js';
import { Lanes } from './lanes.js';

/** What a receipt must carry for us. viem's TransactionReceipt satisfies it. */
export interface ReceiptLike {
  readonly status: 'success' | 'reverted';
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
  readonly logs: readonly { address: Hex; data: Hex; topics: readonly Hex[] }[];
}

/** The outcome shape of the SDK's pcl.simulatePclProxy (only what we read). */
export type SimulateOutcome =
  | { readonly status: 'succeeded' }
  | {
      readonly status: 'reverted';
      readonly error: unknown;
      readonly revert: { readonly errorName: string; readonly args?: readonly unknown[] } | null;
    };

/**
 * The slice of a viem public client (with the Maroo actions) this provider uses. A narrow port so
 * tests can pass plain fakes; the real client satisfies it structurally (chain-clients wiring).
 */
export interface PublicPort {
  getBalance(a: { address: Hex }): Promise<bigint>;
  getTransactionCount(a: { address: Hex; blockTag: 'pending' }): Promise<number>;
  getBlock(a?: { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
  estimateGas(a: { account: Hex; to: Hex; data?: Hex; value?: bigint }): Promise<bigint>;
  call(a: {
    account: Hex;
    to: Hex;
    data?: Hex;
    value?: bigint;
    blockNumber?: bigint;
  }): Promise<unknown>;
  waitForTransactionReceipt(a: {
    hash: Hex;
    timeout?: number;
    confirmations?: number;
  }): Promise<ReceiptLike>;
  /** Rejects with viem's TransactionReceiptNotFoundError when there is no receipt (yet). */
  getTransactionReceipt(a: { hash: Hex }): Promise<ReceiptLike>;
  getTransaction(a: {
    hash: Hex;
  }): Promise<{ from: Hex; to: Hex | null; input: Hex; value: bigint }>;
  sendRawTransaction(a: { serializedTransaction: Hex }): Promise<Hex>;
  getBlockNumber(): Promise<bigint>;
  getLogs(a: {
    address: Hex;
    event: unknown;
    args?: unknown;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<readonly { transactionHash: Hex | null; blockNumber: bigint | null }[]>;
  readContract(a: {
    address: Hex;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  pcl: {
    simulatePclProxy(a: {
      account: Hex;
      address: Hex;
      abi: Abi;
      functionName: string;
      args: readonly unknown[];
      value?: bigint;
    }): Promise<SimulateOutcome>;
  };
}

/** One signer's wallet client (the operator or one agent). */
export interface WalletPort {
  prepareTransactionRequest(a: {
    to: Hex;
    data?: Hex;
    value?: bigint;
    nonce?: number;
    gas?: bigint;
  }): Promise<PreparedTx>;
  signTransaction(a: PreparedTx): Promise<Hex>;
  sendTransaction(a: { to: Hex; data?: Hex; value?: bigint }): Promise<Hex>;
}

/** A prepared transaction request: fee fields differ by type, so they stay opaque here. */
export type PreparedTx = {
  readonly to?: Hex | null;
  readonly value?: bigint;
  readonly nonce?: number;
  readonly gas?: bigint;
  readonly gasPrice?: bigint;
  readonly maxFeePerGas?: bigint;
  readonly [k: string]: unknown;
};

export interface ManagedEoaConfig {
  readonly operator: Account;
  readonly registry: Hex;
  readonly proxy: Hex;
  readonly deployBlock: bigint;
  /** The most blocks one getLogs call may cover (chain config maxLogBlockSpan). */
  readonly logBlockSpan: bigint;
  /** The most getLogs chunks one findPaid call reads (chain config findPaidMaxChunks). */
  readonly findPaidMaxChunks: number;
  readonly gasShareAokrw: bigint;
  readonly confirmations: number;
  /** How long to wait for a receipt before the result is "unknown" (ms). */
  readonly receiptTimeoutMs?: number;
}

export interface ManagedEoaDeps {
  readonly publicClient: PublicPort;
  /** The operator's wallet client. */
  readonly operatorWallet: WalletPort;
  /** A wallet client for one agent account (viem local account with the opened key). */
  readonly walletFor: (account: PrivateKeyAccount) => WalletPort;
  /**
   * Signs the 8004 `setAgentWallet` authorization with the agent's key (EIP-712
   * AgentWalletSet(agentId, newWallet, owner, deadline) against the registry's eip712Domain).
   */
  readonly signWalletAuthorization: (
    account: PrivateKeyAccount,
    message: { agentId: bigint; newWallet: Hex; owner: Hex; deadline: bigint },
  ) => Promise<Hex>;
  readonly vault: AgentKeyVault;
  readonly config: ManagedEoaConfig;
}

/** Clock slack under findPaid's lower bound: block time and server time are not the same clock. */
const FIND_PAID_MARGIN_MS = 10 * 60_000;
const RECEIPT_TIMEOUT_MS = 90_000;
const DEADLINE_SECONDS = 240n;
const TRANSFER_LIMIT_KEY = 'TransferLimit';

const unknown = (reason: string, extra: Record<string, unknown> = {}) =>
  new AppError('INTERNAL', { reason, ...extra });

/**
 * Path B (D-25): the server holds one EOA key per agent (AgentKeyVault) and the operator owns the
 * agents. The agent signs placeOrder itself and is the direct sender, so the contract-scope PCL
 * policies see the agent (maroo-facts 3.3). Operator work (8004 register, setAgentWallet,
 * setMetadata, bindAgent, pause, fund) and the agent's own sends never share a nonce lane.
 * Nothing here retries a payment (CLAUDE.md 9); a lost answer is thrown and the order stays
 * submitting (payment.md). The only places money leaves are the orders contract and, for drain,
 * the owner.
 */
export class ManagedEoaPaymentProvider implements PaymentProvider {
  readonly path = 'B' as const;
  readonly gasReserveAokrw: bigint;
  private readonly operatorLane = new Lanes();
  private readonly agentLanes = new Lanes();

  constructor(private readonly d: ManagedEoaDeps) {
    this.gasReserveAokrw = d.config.gasShareAokrw;
  }

  private get operator(): Hex {
    return this.d.config.operator.address;
  }

  // ------------------------------------------------------------ owner work (operator)

  async createAgent(input: {
    readonly userId: string;
    readonly name: string;
    readonly agentRowId?: string;
  }): Promise<AgentWallet> {
    // The key is saved before anything goes on chain: a crash later never loses a key. A retry of
    // the same agents row reuses its saved key (it may already hold funds), never a second one.
    const address =
      (input.agentRowId === undefined ? undefined : this.d.vault.addressFor(input.agentRowId)) ??
      this.d.vault.create(input.agentRowId);
    const { registry } = this.d.config;
    // Each on-chain step is resumable: the 8004 id is saved right after register() succeeds, and
    // the wallet link is read before it is written. A retry never registers a second id.
    let agentId = this.d.vault.onchainAgentIdOf(address);
    if (agentId === undefined) {
      const { receipt } = await this.operatorTx(
        {
          to: registry,
          data: encodeFunctionData({ abi: identityRegistryAbi, functionName: 'register' }),
        },
        'register',
      );
      const registered = parseEventLogs({
        abi: identityRegistryAbi,
        eventName: 'Registered',
        logs: receipt.logs.filter((l) => l.address.toLowerCase() === registry.toLowerCase()),
      } as never) as unknown as readonly { args: { agentId: bigint } }[];
      const first = registered[0];
      if (first === undefined) throw unknown('8004 register emitted no Registered event');
      agentId = first.args.agentId;
      this.d.vault.recordOnchainAgentId(address, agentId);
    }

    const readLink = async (): Promise<boolean> => {
      const linked = await this.d.publicClient.readContract({
        address: registry,
        abi: identityRegistryAbi,
        functionName: 'getAgentWallet',
        args: [agentId],
      });
      return typeof linked === 'string' && linked.toLowerCase() === address.toLowerCase();
    };
    if (!(await readLink())) {
      // Link the wallet: the agent signs, the owner (operator) sends (EIP-712 AgentWalletSet).
      const now = (await this.d.publicClient.getBlock()).timestamp;
      const deadline = now + DEADLINE_SECONDS;
      const id = agentId;
      const signature = await this.d.vault.withAccount(address, (account) =>
        this.d.signWalletAuthorization(account, {
          agentId: id,
          newWallet: address,
          owner: this.operator,
          deadline,
        }),
      );
      await this.operatorTx(
        {
          to: registry,
          data: encodeFunctionData({
            abi: identityRegistryAbi,
            functionName: 'setAgentWallet',
            args: [agentId, address, deadline, signature],
          }),
        },
        'setAgentWallet',
      );
      if (!(await readLink())) {
        throw unknown('8004 wallet link did not hold', { agentId: agentId.toString() });
      }
    }
    return {
      agentRowId: input.agentRowId ?? '',
      address,
      onchainAgentId: agentId,
      ownerAddress: this.operator,
    };
  }

  async setTransferLimit(agent: AgentWallet, amount: bigint): Promise<Hex> {
    if (amount <= 0n) throw unknown('TransferLimit must be positive');
    if (agent.onchainAgentId === undefined) throw unknown('agent has no 8004 id yet');
    const { hash } = await this.operatorTx(
      {
        to: this.d.config.registry,
        data: encodeFunctionData({
          abi: identityRegistryAbi,
          functionName: 'setMetadata',
          args: [
            agent.onchainAgentId,
            TRANSFER_LIMIT_KEY,
            encodeAbiParameters([{ type: 'uint256' }], [amount]),
          ],
        }),
      },
      'setMetadata',
    );
    return hash;
  }

  async bindAgent(agent: AgentWallet): Promise<Hex> {
    return this.ordersOwnerCall(
      encodeFunctionData({ abi: ordersAbi, functionName: 'bindAgent', args: [agent.address] }),
      'bindAgent',
    );
  }

  async freeze(agent: AgentWallet): Promise<Hex[]> {
    return [await this.pause(agent, true)];
  }

  async unfreeze(agent: AgentWallet): Promise<Hex[]> {
    return [await this.pause(agent, false)];
  }

  private pause(agent: AgentWallet, paused: boolean): Promise<Hex> {
    return this.ordersOwnerCall(
      encodeFunctionData({
        abi: ordersAbi,
        functionName: 'setAgentPaused',
        args: [agent.address, paused],
      }),
      'setAgentPaused',
    );
  }

  /** Operator to agent wallet: the only inbound money path (JIT float and gas share). */
  async fund(agent: AgentWallet, amount: bigint): Promise<Hex> {
    if (amount <= 0n) throw unknown('fund amount must be positive');
    const { hash } = await this.operatorTx({ to: agent.address, value: amount }, 'fund');
    return hash;
  }

  /**
   * Agent wallet to the owner (operator while custodial): everything but the gas the sweep itself
   * costs. Nothing left to sweep gives no transaction.
   */
  async drain(agent: AgentWallet): Promise<Hex[]> {
    const owner = agent.ownerAddress;
    return this.agentLanes.run(agent.address, () =>
      this.d.vault.withAccount(agent.address, async (account) => {
        const balance = await this.d.publicClient.getBalance({ address: agent.address });
        // An empty wallet cannot even be priced (the estimate fails with insufficient funds).
        if (balance <= 0n) return [];
        const wallet = this.d.walletFor(account);
        const nonce = await this.d.publicClient.getTransactionCount({
          address: agent.address,
          blockTag: 'pending',
        });
        // Price the sweep with a 1 aokrw value, then send balance minus the worst-case fee.
        const probe = await wallet.prepareTransactionRequest({ to: owner, value: 1n, nonce });
        const fee = feeOf(probe);
        const value = balance - fee;
        if (value <= 0n) return [];
        const prepared = await wallet.prepareTransactionRequest({
          to: owner,
          value,
          nonce,
          ...(probe.gas === undefined ? {} : { gas: probe.gas }),
        });
        if (feeOf(prepared) + value > balance) throw unknown('drain fee moved, nothing sent');
        const serialized = await wallet.signTransaction(prepared);
        const hash = await this.d.publicClient.sendRawTransaction({
          serializedTransaction: serialized,
        });
        this.mustSucceed(await this.wait(hash), 'drain');
        return [hash];
      }),
    );
  }

  balanceOf(address: Hex): Promise<bigint> {
    return this.d.publicClient.getBalance({ address });
  }

  // ------------------------------------------------------------ paying (the agent)

  async preflight(
    req: PayRequest,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: DecodedChainError }> {
    const balance = await this.d.publicClient.getBalance({ address: req.agent.address });
    if (balance < req.amount) return { ok: false, error: { code: 'CHAIN_INSUFFICIENT_FUNDS' } };
    const outcome = await this.d.publicClient.pcl.simulatePclProxy({
      account: req.agent.address,
      address: this.d.config.proxy,
      abi: ordersAbi,
      functionName: 'placeOrder',
      args: [req.merchantOnchainId, req.orderRef],
      value: req.amount,
    });
    if (outcome.status === 'succeeded') return { ok: true };
    return { ok: false, error: this.errorOfReverted(outcome) };
  }

  async pay(req: PayRequest): Promise<PayResult> {
    const { proxy } = this.d.config;
    const data = encodeFunctionData({
      abi: ordersAbi,
      functionName: 'placeOrder',
      args: [req.merchantOnchainId, req.orderRef],
    });
    return this.agentLanes.run(req.agent.address, () =>
      this.d.vault.withAccount(req.agent.address, async (account) => {
        const agent = account.address;
        // 1. Price the call. A refusal here means nothing was signed: no gas is spent.
        let gas: bigint;
        try {
          gas = await this.d.publicClient.estimateGas({
            account: agent,
            to: proxy,
            data,
            value: req.amount,
          });
        } catch (e) {
          const error = decodeChainFailure(e);
          if (error.code === 'INTERNAL') throw unknown('gas estimate failed', cause(e));
          return { ok: false, stage: 'preflight', error } as const;
        }
        // 2. Sign with a nonce read now. The hash exists before anything is broadcast.
        const wallet = this.d.walletFor(account);
        const nonce = await this.d.publicClient.getTransactionCount({
          address: agent,
          blockTag: 'pending',
        });
        const prepared = await wallet.prepareTransactionRequest({
          to: proxy,
          data,
          value: req.amount,
          nonce,
          gas,
        });
        const serialized = await wallet.signTransaction(prepared);
        const txHash = keccak256(serialized);
        // 3. The caller saves hash and nonce first (payment.md "제출 시작 표시"). If it throws,
        // nothing is broadcast.
        await req.beforeBroadcast?.({ txHash, nonce });
        // 4. Broadcast once. A wallet that cannot cover value plus gas is refused by the node
        // before inclusion (no gas spent); any other failure leaves the result unknown.
        try {
          await this.d.publicClient.sendRawTransaction({ serializedTransaction: serialized });
        } catch (e) {
          const error = decodeChainFailure(e);
          if (error.code === 'CHAIN_INSUFFICIENT_FUNDS' || error.code === 'CHAIN_KYC_LIMIT') {
            return { ok: false, stage: 'submit', error } as const;
          }
          throw unknown('broadcast failed, result unknown', { txHash, ...cause(e) });
        }
        // 5. Wait. A timeout is "unknown": the transaction may still land.
        let receipt: ReceiptLike;
        try {
          receipt = await this.wait(txHash);
        } catch (e) {
          throw unknown('no receipt yet, result unknown', { txHash, ...cause(e) });
        }
        if (receipt.status === 'success') {
          if (!this.placedBy(receipt, req.orderRef)) {
            throw unknown('receipt has no OrderPlaced for this orderRef', { txHash });
          }
          return { ok: true, txHash, blockNumber: receipt.blockNumber } as const;
        }
        return {
          ok: false,
          stage: 'execution',
          error: await this.replayRevert(agent, proxy, data, req.amount, receipt.blockNumber),
          txHash,
        } as const;
      }),
    );
  }

  async findPaid(
    orderRef: Hex,
    sinceMs?: number,
  ): Promise<{ txHash: Hex; blockNumber: bigint } | null> {
    const latest = await this.d.publicClient.getBlockNumber();
    const event = ordersAbi.find((i) => i.type === 'event' && i.name === 'OrderPlaced');
    const from =
      sinceMs === undefined
        ? this.d.config.deployBlock
        : await this.blockBefore(sinceMs - FIND_PAID_MARGIN_MS, latest);
    // Newest first, within the RPC's range cap, so a recent order is found in the first call.
    // The chunk cap bounds the calls of a search that finds nothing.
    const ranges = logRanges(from, latest, this.d.config.logBlockSpan, true);
    for (const range of ranges.slice(0, this.d.config.findPaidMaxChunks)) {
      const logs = await this.d.publicClient.getLogs({
        address: this.d.config.proxy,
        event,
        args: { orderRef },
        fromBlock: range.from,
        toBlock: range.to,
      });
      const hit = logs[0];
      if (hit?.transactionHash == null || hit.blockNumber == null) continue;
      return { txHash: hit.transactionHash, blockNumber: hit.blockNumber };
    }
    return null;
  }

  /**
   * The newest block mined at or before `ms` (binary search on block timestamps), never below the
   * deploy block. Any read failure gives the deploy block: a wider search, never a missed order.
   */
  private async blockBefore(ms: number, latest: bigint): Promise<bigint> {
    const target = BigInt(Math.floor(ms / 1000));
    let lo = this.d.config.deployBlock;
    let hi = latest;
    try {
      while (lo < hi) {
        const mid = (lo + hi + 1n) / 2n;
        const block = await this.d.publicClient.getBlock({ blockNumber: mid });
        if (block.timestamp <= target) lo = mid;
        else hi = mid - 1n;
      }
    } catch {
      return this.d.config.deployBlock;
    }
    return lo;
  }

  async receiptOf(txHash: Hex): Promise<ReceiptOutcome> {
    let receipt: ReceiptLike;
    try {
      receipt = await this.d.publicClient.getTransactionReceipt({ hash: txHash });
    } catch (e) {
      // No receipt is a plain answer; any other failure means the chain could not be read.
      if (e instanceof Error && e.name === 'TransactionReceiptNotFoundError') {
        return { status: 'unknown' };
      }
      throw unknown('receipt lookup failed', { txHash, ...cause(e) });
    }
    if (receipt.status === 'success') {
      return { status: 'success', blockNumber: receipt.blockNumber };
    }
    let error: DecodedChainError = { code: 'INTERNAL' };
    try {
      const tx = await this.d.publicClient.getTransaction({ hash: txHash });
      if (tx.to !== null) {
        error = await this.replayRevert(tx.from, tx.to, tx.input, tx.value, receipt.blockNumber);
      }
    } catch {
      // The reason stays unread (INTERNAL): the order is then left to a person.
    }
    return { status: 'reverted', blockNumber: receipt.blockNumber, error };
  }

  // ------------------------------------------------------------ internals

  /**
   * One operator write at a time, each confirmed before the next, so the operator's nonces never
   * collide (the same lane serves every call of this process).
   */
  private operatorTx(
    tx: { to: Hex; data?: Hex; value?: bigint },
    what: string,
  ): Promise<{ hash: Hex; receipt: ReceiptLike }> {
    return this.operatorLane.run('operator', async () => {
      const hash = await this.d.operatorWallet.sendTransaction(tx);
      const receipt = await this.wait(hash);
      this.mustSucceed(receipt, what);
      return { hash, receipt };
    });
  }

  private async ordersOwnerCall(data: Hex, what: string): Promise<Hex> {
    const { hash } = await this.operatorTx({ to: this.d.config.proxy, data }, what);
    return hash;
  }

  private wait(hash: Hex): Promise<ReceiptLike> {
    return this.d.publicClient.waitForTransactionReceipt({
      hash,
      timeout: this.d.config.receiptTimeoutMs ?? RECEIPT_TIMEOUT_MS,
      confirmations: this.d.config.confirmations,
    });
  }

  private mustSucceed(receipt: ReceiptLike, what: string): void {
    if (receipt.status !== 'success') {
      throw unknown(`${what} reverted on chain`, { txHash: receipt.transactionHash });
    }
  }

  private placedBy(receipt: ReceiptLike, orderRef: Hex): boolean {
    const proxy = this.d.config.proxy.toLowerCase();
    const events = parseEventLogs({
      abi: ordersAbi,
      eventName: 'OrderPlaced',
      logs: receipt.logs.filter((l) => l.address.toLowerCase() === proxy),
    } as never) as unknown as readonly { args: { orderRef: Hex } }[];
    return events.some((e) => e.args.orderRef.toLowerCase() === orderRef.toLowerCase());
  }

  private errorOfReverted(
    outcome: Extract<SimulateOutcome, { status: 'reverted' }>,
  ): DecodedChainError {
    // Our contract's own errors are not in the SDK's table, so the raw bytes are decoded again.
    const data = revertDataOf(outcome.error);
    const raw = data === null ? null : decodeRevert(data);
    if (raw !== null) return chainErrorOf(raw);
    if (outcome.revert !== null) {
      return chainErrorOf({ name: outcome.revert.errorName, args: outcome.revert.args ?? [] });
    }
    return decodeChainFailure(outcome.error);
  }

  /** A reverted receipt carries no reason: run the same call at that block to read it. */
  private async replayRevert(
    agent: Hex,
    to: Hex,
    data: Hex,
    value: bigint,
    blockNumber: bigint,
  ): Promise<DecodedChainError> {
    try {
      await this.d.publicClient.call({ account: agent, to, data, value, blockNumber });
      return { code: 'INTERNAL' };
    } catch (e) {
      return decodeChainFailure(e);
    }
  }
}

function feeOf(tx: PreparedTx): bigint {
  const perGas = tx.maxFeePerGas ?? tx.gasPrice;
  if (tx.gas === undefined || perGas === undefined) throw unknown('transaction has no fee');
  return tx.gas * perGas;
}

/** Error text for logs only (never a key: nothing here ever holds one in a message). */
function cause(e: unknown): Record<string, unknown> {
  return { cause: e instanceof Error ? e.message.slice(0, 300) : 'unknown' };
}
