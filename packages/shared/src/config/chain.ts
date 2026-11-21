import { AppError } from '../errors/index.js';

/**
 * Chain settings live only here (CLAUDE.md rule 2). Values are (확인) in
 * docs/_research/maroo-facts.md, except schemaRegistry (미확인, tech-spec 7.2 only). The testnet chain id is going to change, so
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
  /**
   * The most blocks one eth_getLogs call may cover. The testnet RPC rejects a wider range with
   * "maximum [from, to] blocks distance: 10000" (maroo-facts.md). Read logs in chunks of this size.
   */
  readonly maxLogBlockSpan: number;
  readonly precompiles: {
    readonly pcl: `0x${string}`;
    readonly agent: `0x${string}`;
    readonly identityRegistry: `0x${string}`;
    /** (미확인) Address appears only in tech-spec 7.2. Confirm before the KYB schema step. */
    readonly schemaRegistry: `0x${string}`;
  };
}

function deepFreeze<T extends object>(value: T): T {
  for (const inner of Object.values(value)) {
    if (inner !== null && typeof inner === 'object') deepFreeze(inner as object);
  }
  return Object.freeze(value);
}

export const NETWORKS: { readonly [K in NetworkKey]: ChainConfig } = deepFreeze({
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
    maxLogBlockSpan: 10_000,
    precompiles: {
      pcl: '0x1000000000000000000000000000000000000005',
      agent: '0x100000000000000000000000000000000000000A',
      identityRegistry: '0x8004000000000000000000000000000000000001',
      schemaRegistry: '0x1000000000000000000000000000000000000006',
    },
  },
});

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
  if (!isHttpUrlWithHost(rpcUrl)) {
    throw new AppError('INTERNAL', { reason: 'invalid rpc url' });
  }
  // The denom goes into PCL policy encodings; an empty or malformed value would
  // put the 30-day cap on the wrong token (chain-and-pcl.md).
  const okrwDenom = overrides.okrwDenom ?? base.okrwDenom;
  if (!DENOM_RE.test(okrwDenom)) {
    throw new AppError('INTERNAL', { reason: 'invalid okrw denom' });
  }
  return deepFreeze({ ...base, chainId, rpcUrl, okrwDenom });
}

const DENOM_RE = /^[a-z][a-z0-9/:._-]{2,127}$/;

// shared has no DOM or node types, so no URL global: scheme, then a non-empty host.
const HTTP_URL_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[^\s]*)?$/;

function isHttpUrlWithHost(value: string): boolean {
  return HTTP_URL_RE.test(value);
}

/** Explorer link for the "자세히 보기" detail view only (D-17). */
export function explorerTxUrl(chain: ChainConfig, txHash: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new AppError('VALIDATION_FAILED', { reason: 'invalid tx hash' });
  }
  return `${chain.explorerUrl}/tx/${txHash}`;
}

/**
 * Splits the inclusive block range [from, to] into ranges of at most `span` blocks, oldest first,
 * or newest first when asked (so a search for one event can stop at the first hit).
 */
export function logRanges(
  from: bigint,
  to: bigint,
  span: bigint,
  newestFirst = false,
): { from: bigint; to: bigint }[] {
  if (span <= 0n) throw new AppError('INTERNAL', { reason: 'invalid log span' });
  const out: { from: bigint; to: bigint }[] = [];
  if (newestFirst) {
    for (let end = to; end >= from; end -= span) {
      out.push({ from: end - span + 1n > from ? end - span + 1n : from, to: end });
    }
  } else {
    for (let start = from; start <= to; start += span) {
      out.push({ from: start, to: start + span - 1n < to ? start + span - 1n : to });
    }
  }
  return out;
}
