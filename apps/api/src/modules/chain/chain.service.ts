import type { Hex } from '@sikyeoyong/shared';

/**
 * Chain reads other modules need (chain-and-pcl.md, tech-spec 3.9). Only the
 * chain module talks to the RPC; others get this interface by token.
 */
export interface PeriodicVolume {
  /** 30-day volume used through placeOrder, aokrw. */
  readonly usedAokrw: bigint;
  /** Chain resetAt in unix seconds, null when no order opened a window yet. */
  readonly resetAtSec: number | null;
}

export interface ChainReader {
  /**
   * contractPeriodicVolume(proxy, agent, placeOrderSelector, okrwDenom) for the
   * agent wallet (maroo-facts 3.2). Return shape on chain is (미확인); the real
   * reader lands with the contract deployment.
   */
  periodicVolume(agentWallet: `0x${string}` | null): Promise<PeriodicVolume>;
}

export const CHAIN_READER = Symbol('CHAIN_READER');

/** One OrderPlaced log of the orders proxy. */
export interface PlacedLog {
  readonly orderRef: Hex;
  readonly txHash: Hex;
  readonly logIndex: number;
  readonly blockNumber: bigint;
}

/**
 * What the indexer reads from the chain (chain-and-pcl.md, tech-spec 3.9). The orders module gets
 * this by token and decides what a log means.
 */
export interface OrderEventsReader {
  /** The first block to read: the deployment block of the orders proxy. */
  readonly startBlock: bigint;
  latestBlock(): Promise<bigint>;
  /** OrderPlaced logs of the proxy in [from, to], both inclusive. */
  orderPlaced(from: bigint, to: bigint): Promise<readonly PlacedLog[]>;
}

export const ORDER_EVENTS = Symbol('ORDER_EVENTS');

// The reader factory, for owner-run scripts that build their own reader (payment e2e).
export { createChainReader } from './chain-reader.factory.js';
