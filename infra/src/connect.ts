import { marooPublicActions, marooTestnet, marooWalletActions } from '@maroo-chain/viem';
import { resolveChainConfig, type ChainConfig, type NetworkKey } from '@sikyeoyong/shared';
import {
  createPublicClient,
  type Chain,
  createWalletClient,
  formatEther,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * Clients for the deploy CLI. Chain id and RPC come from packages/shared config (CLAUDE.md 2);
 * only the SDK chain definition is reused, with those two values replaced. The key is read from
 * OPERATOR_KEY and is never printed or stored.
 */
export function readOperatorKey(env: NodeJS.ProcessEnv): Hex {
  const raw = env['OPERATOR_KEY'] ?? '';
  const hex = raw.startsWith('0x') ? raw : `0x${raw}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    // The message never includes the value.
    throw new Error('OPERATOR_KEY is missing or is not a 32 byte hex key');
  }
  return hex as Hex;
}

export function connect(network: NetworkKey, env: NodeJS.ProcessEnv) {
  const chainConfig: ChainConfig = resolveChainConfig(network, {
    rpcUrl: env['MAROO_RPC_URL'] || undefined,
    chainId: env['CHAIN_ID'] ? Number(env['CHAIN_ID']) : undefined,
  });
  // The SDK chain definition carries Maroo's fee and prepare hooks; only id and rpc are replaced.
  const chain = {
    ...marooTestnet,
    id: chainConfig.chainId,
    rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  } as unknown as Chain;
  const account = privateKeyToAccount(readOperatorKey(env));
  const publicClient = createPublicClient({ chain, transport: http(chainConfig.rpcUrl) }).extend(
    marooPublicActions(),
  );
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chainConfig.rpcUrl),
  }).extend(marooWalletActions());
  return { chainConfig, chain, account, publicClient, walletClient };
}

/**
 * Stops before a write that would push the gas spent past the budget (aokrw bigint). Spent is
 * measured as the balance drop since the start, so Maroo's rule of charging half of the gas limit
 * regardless of use (maroo-facts 4) is counted too.
 */
export class SpendGuard {
  private readonly startBalance: bigint;
  private readonly budgetAokrw: bigint;

  constructor(startBalance: bigint, budgetAokrw: bigint) {
    this.startBalance = startBalance;
    this.budgetAokrw = budgetAokrw;
  }

  spent(currentBalance: bigint): bigint {
    return this.startBalance - currentBalance;
  }

  /** Throws if the worst case of this write (gas limit times price) would pass the budget. */
  assertCanSpend(currentBalance: bigint, gasLimit: bigint, gasPrice: bigint): void {
    const worst = gasLimit * gasPrice;
    const spent = this.spent(currentBalance);
    if (spent + worst > this.budgetAokrw) {
      const text = [spent, worst, this.budgetAokrw].map((v) => formatEther(v));
      throw new Error(
        `gas budget: spent ${text[0]} + worst case ${text[1]} passes ${text[2]} OKRW`,
      );
    }
  }
}
