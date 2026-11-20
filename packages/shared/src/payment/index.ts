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
  /** Creates the wallet and waits for the 8004 registration. */
  createAgent(input: { readonly userId: string; readonly name: string }): Promise<AgentWallet>;
  /** 8004 setMetadata("TransferLimit"), before the agent may order (payment.md MUST). */
  setTransferLimit(agent: AgentWallet, amount: bigint): Promise<Hex>;
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
