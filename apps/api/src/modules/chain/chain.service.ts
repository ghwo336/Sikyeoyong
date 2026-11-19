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
