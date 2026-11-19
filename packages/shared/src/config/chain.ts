import { AppError } from '../errors/index.js';

/**
 * Chain settings live only here (CLAUDE.md rule 2). Values are (확인) in
 * docs/_research/maroo-facts.md. The testnet chain id is going to change, so
 * code looks networks up by key, never by number, and the API checks the id
 * against eth_chainId at boot.
 */
export type NetworkKey = 'maroo-testnet';

export interface ChainConfig {
  readonly key: NetworkKey;
  readonly name: string;
  readonly chainId: number;
  readonly rpcUrl: string;
  readonly wsUrl: string;
  readonly explorerUrl: string;
  readonly faucetUrl: string;
  readonly kycUrl: string;
  /** Native OKRW denom used in PCL policy encodings (tech-spec 5.4). */
  readonly okrwDenom: string;
  readonly okrwDecimals: 18;
  readonly precompiles: {
    readonly pcl: `0x${string}`;
    readonly agent: `0x${string}`;
    readonly identityRegistry: `0x${string}`;
    readonly schemaRegistry: `0x${string}`;
  };
}

export const NETWORKS: { readonly [K in NetworkKey]: ChainConfig } = {
  'maroo-testnet': {
    key: 'maroo-testnet',
    name: 'Maroo Testnet',
    chainId: 450815,
    rpcUrl: 'https://rpc-testnet.maroo.io',
    wsUrl: 'wss://ws-testnet.maroo.io',
    explorerUrl: 'https://explorer-testnet.maroo.io',
    faucetUrl: 'https://faucet.maroo.io',
    kycUrl: 'https://kyc-testnet.maroo.io',
    okrwDenom: 'atokrw',
    okrwDecimals: 18,
    precompiles: {
      pcl: '0x1000000000000000000000000000000000000005',
      agent: '0x100000000000000000000000000000000000000A',
      identityRegistry: '0x8004000000000000000000000000000000000001',
      schemaRegistry: '0x1000000000000000000000000000000000000006',
    },
  },
};

/** Values the API may override from its environment (names in tech-spec 8.3). */
export interface ChainOverrides {
  readonly chainId?: number | undefined;
  readonly rpcUrl?: string | undefined;
  readonly okrwDenom?: string | undefined;
}

export function isNetworkKey(value: string): value is NetworkKey {
  return Object.prototype.hasOwnProperty.call(NETWORKS, value);
}

/**
 * Pure merge of a network's defaults with overrides. shared never reads the
 * environment itself; apps/api passes CHAIN_ID, MAROO_RPC_URL, OKRW_DENOM in.
 */
export function resolveChainConfig(network: string, overrides: ChainOverrides = {}): ChainConfig {
  if (!isNetworkKey(network)) {
    throw new AppError('INTERNAL', { reason: 'unknown network', network });
  }
  const base = NETWORKS[network];
  const chainId = overrides.chainId ?? base.chainId;
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new AppError('INTERNAL', { reason: 'invalid chain id', chainId });
  }
  const rpcUrl = overrides.rpcUrl ?? base.rpcUrl;
  if (!/^https?:\/\//.test(rpcUrl)) {
    throw new AppError('INTERNAL', { reason: 'invalid rpc url' });
  }
  return {
    ...base,
    chainId,
    rpcUrl,
    okrwDenom: overrides.okrwDenom ?? base.okrwDenom,
  };
}

/** Explorer link for the "자세히 보기" detail view only (D-17). */
export function explorerTxUrl(chain: ChainConfig, txHash: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new AppError('VALIDATION_FAILED', { reason: 'invalid tx hash' });
  }
  return `${chain.explorerUrl}/tx/${txHash}`;
}
