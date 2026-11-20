import type { AppErrorCode } from '../errors/index.js';

/**
 * Payment boundary types (tech-spec 3.4, payment.md). Implementations live in
 * apps/api/src/modules/payment, one per path. Code above PaymentProvider
 * (orders, llm) never knows which path runs; only the receipt reads `path`.
 */
export type PaymentPath = 'A' | 'B' | 'C' | 'mock';

export type Hex = `0x${string}`;

export interface AgentWallet {
  /** agents.id in the DB. */
  readonly agentRowId: string;
  readonly address: Hex;
  /** ERC-8004 agentId, once registered. */
  readonly onchainAgentId?: bigint;
  readonly ownerAddress: Hex;
}

/** A chain refusal turned into our error code (chain-and-pcl.md revert table). */
export interface DecodedChainError {
  readonly code: AppErrorCode;
  /** Values for the dragon line, e.g. { max: '10,000원' } or { resetAt: '12월 1일 오후 3시' }. */
  readonly params?: Readonly<Record<string, string>>;
}

export interface PayRequest {
  readonly agent: AgentWallet;
  readonly merchantOnchainId: bigint;
  /** aokrw */
  readonly amount: bigint;
  /** bytes32, made once from the DB order id; the same order retries only with this (D-19). */
  readonly orderRef: Hex;
  /**
   * Path B and C: called with the signed transaction's hash and nonce before it is broadcast. The
   * caller saves them (orders.submit_tx_hash, submit_nonce, payment.md "제출 시작 표시"). If this
   * throws, nothing is broadcast. Providers with no local signing (mock) never call it.
   */
  readonly beforeBroadcast?: (signed: {
    readonly txHash: Hex;
    readonly nonce: number;
  }) => void | Promise<void>;
}

export type PayResult =
  | { readonly ok: true; readonly txHash: Hex; readonly blockNumber: bigint }
  | {
      readonly ok: false;
      readonly stage: 'server' | 'preflight' | 'submit' | 'execution';
      readonly error: DecodedChainError;
      readonly txHash?: Hex;
    };

export interface PaymentProvider {
  readonly path: PaymentPath;
  /**
   * Path B: aokrw each agent wallet must hold on top of an order's amount for gas (D-25, no
   * paymaster). Confirm's top-up adds it. Absent means 0 (mock, and paths with a paymaster).
   */
  readonly gasReserveAokrw?: bigint;
  /** Creates the wallet and waits for the 8004 registration. */
  createAgent(input: {
    readonly userId: string;
    readonly name: string;
    /** agents.id when the row exists, so a path B key can be linked to it. */
    readonly agentRowId?: string;
  }): Promise<AgentWallet>;
  /** 8004 setMetadata("TransferLimit"), before the agent may order (payment.md MUST). */
  setTransferLimit(agent: AgentWallet, amount: bigint): Promise<Hex>;
  /** SikyeoyongOrders.bindAgent: links the agent to its owner on the contract (operator only in phase 1). */
  bindAgent(agent: AgentWallet): Promise<Hex>;
  fund(agent: AgentWallet, amount: bigint): Promise<Hex>;
  drain(agent: AgentWallet): Promise<Hex[]>;
  freeze(agent: AgentWallet): Promise<Hex[]>;
  unfreeze(agent: AgentWallet): Promise<Hex[]>;
  preflight(
    req: PayRequest,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: DecodedChainError }>;
  pay(req: PayRequest): Promise<PayResult>;
  /** Has OrderPlaced(orderRef) happened on chain? Confirm asks before a retry (D-19). */
  findPaid(orderRef: Hex): Promise<{ readonly txHash: Hex; readonly blockNumber: bigint } | null>;
  /** aokrw balance of a wallet (float top-up math). */
  balanceOf(address: Hex): Promise<bigint>;
}
export * from './owner.js';
