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

/** Read-only clients: no key needed (CLI --check and other reads). */
export function connectReadOnly(network: NetworkKey, env: NodeJS.ProcessEnv) {
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
  const publicClient = createPublicClient({ chain, transport: http(chainConfig.rpcUrl) }).extend(
    marooPublicActions(),
  );
  return { chainConfig, chain, publicClient };
}

/** Read-only clients plus the operator account and wallet client. Needs OPERATOR_KEY. */
export function connect(network: NetworkKey, env: NodeJS.ProcessEnv) {
  const base = connectReadOnly(network, env);
  const account = privateKeyToAccount(readOperatorKey(env));
  const walletClient = createWalletClient({
    account,
    chain: base.chain,
    transport: http(base.chainConfig.rpcUrl),
  }).extend(marooWalletActions());
  return { ...base, account, walletClient };
}

/** Worst case gas for a write: Maroo charges half of the limit even when unused (maroo-facts 4),
 * so the estimate is doubled to cover a limit chosen above it. */
export function worstCaseGas(estimate: bigint): bigint {
  return estimate * 2n;
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
    this.assertCanSpendAmount(currentBalance, gasLimit * gasPrice);
  }

  /** Throws if spent so far plus this extra outflow (aokrw, gas or gas money sent) passes the budget. */
  assertCanSpendAmount(currentBalance: bigint, extra: bigint): void {
    const spent = this.spent(currentBalance);
    if (spent + extra > this.budgetAokrw) {
      const text = [spent, extra, this.budgetAokrw].map((v) => formatEther(v));
      throw new Error(
        `gas budget: spent ${text[0]} + worst case ${text[1]} passes ${text[2]} OKRW`,
      );
    }
  }
}
