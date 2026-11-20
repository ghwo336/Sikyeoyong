import { marooPublicActions, marooTestnet, marooWalletActions } from '@maroo-chain/viem';
import type { ChainConfig } from '@sikyeoyong/shared';
import { type Account, type Chain, createPublicClient, createWalletClient, http } from 'viem';

/**
 * The SDK chain definition carries Maroo's fee and prepare hooks; only the id and the RPC come
 * from our config (CLAUDE.md rule 2: the chain id will change).
 */
function chainOf(config: ChainConfig): Chain {
  return {
    ...marooTestnet,
    id: config.chainId,
    rpcUrls: { default: { http: [config.rpcUrl] } },
  } as unknown as Chain;
}

/** A read client with the Maroo actions (pcl, identity, agent). */
export function createMarooPublicClient(config: ChainConfig) {
  return createPublicClient({
    chain: chainOf(config),
    transport: http(config.rpcUrl),
  }).extend(marooPublicActions());
}

/** A wallet client for one signing account (the operator or one agent). */
export function createMarooWalletClient(config: ChainConfig, account: Account) {
  return createWalletClient({
    account,
    chain: chainOf(config),
    transport: http(config.rpcUrl),
  }).extend(marooWalletActions());
}
