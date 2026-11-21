import { Abis } from '@maroo-chain/viem';
import {
  type DecodedChainError,
  formatKstDateTime,
  formatOkrw,
  type Hex,
} from '@sikyeoyong/shared';
import { decodeErrorResult } from 'viem';
import { ordersAbi } from './orders-abi.js';

/** Reverts a chain call can carry, ours first (chain-and-pcl.md "revert 매핑"). */
const ERRORS_ABI = [...ordersAbi.filter((i) => i.type === 'error'), ...Abis.errors];

export interface DecodedRevert {
  readonly name: string;
  readonly args: readonly unknown[];
}

const isHex = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v);

/**
 * The raw revert bytes inside a viem error, wherever the layer put them (`data`, `raw`, or
 * `data.data` of an RPC error). Walks the cause chain; null when there are none.
 */
export function revertDataOf(error: unknown): Hex | null {
  let cur: unknown = error;
  for (let depth = 0; depth < 12 && typeof cur === 'object' && cur !== null; depth += 1) {
    const e = cur as { data?: unknown; raw?: unknown; cause?: unknown };
    for (const candidate of [e.raw, e.data, (e.data as { data?: unknown } | undefined)?.data]) {
      if (isHex(candidate) && candidate.length >= 10) return candidate;
    }
    cur = e.cause;
  }
  return null;
}

/** Decodes revert bytes against our contract errors and the Maroo precompile errors. */
export function decodeRevert(data: Hex): DecodedRevert | null {
  try {
    const d = decodeErrorResult({ abi: ERRORS_ABI, data });
    // viem leaves args undefined for an error with no parameters (AgentIsPaused).
    const args = d.args as readonly unknown[] | undefined;
    return { name: d.errorName, args: args ?? [] };
  } catch {
    return null;
  }
}

/** The chain-and-pcl.md table: one revert name to our error code, with the dragon line's values. */
export function chainErrorOf(revert: DecodedRevert): DecodedChainError {
  const [a0, , a2] = revert.args;
  switch (revert.name) {
    case 'ExceededAgentTransferLimit':
      return { code: 'CHAIN_AGENT_LIMIT', params: { max: formatOkrw(asBig(a0)) } };
    case 'ExceededPeriodicVolume':
      return {
        code: 'CHAIN_PERIODIC_LIMIT',
        params: { resetAt: formatKstDateTime(Number(asBig(a2)) * 1000) },
      };
    case 'AgentTransferLimitMetadataInvalid':
      return { code: 'CHAIN_AGENT_LIMIT_UNSET' };
    case 'EasNoAttestationReceived':
    case 'EasAttestationRevoked':
    case 'EasAttestationExpired':
    case 'EasAttestationRequired':
      return { code: 'CHAIN_EAS_REQUIRED' };
    // Unauthorized and our contract's operator and owner checks: a server-side setup problem.
    case 'Unauthorized':
    case 'NotOperator':
    case 'NotAgentOwner':
      return { code: 'CHAIN_UNAUTHORIZED' };
    case 'AgentIsPaused':
      return { code: 'CHAIN_AGENT_PAUSED' };
    // The same orderRef was already paid: confirm settles it as paid via findPaid (rule 9).
    case 'OrderExists':
      return { code: 'CHAIN_ORDER_EXISTS' };
    // The dragon is not bound on chain yet: setup is not finished, a later press may work.
    case 'AgentNotBound':
      return { code: 'CHAIN_AGENT_LIMIT_UNSET' };
    case 'MerchantNotActive':
      return { code: 'CHAIN_MERCHANT_INACTIVE' };
    // The global KYC limit's error name is not confirmed (Q-15). VolumeAboveMaxLimit is the
    // per-transaction template, so it is the best guess, marked (추론) in chain-and-pcl.md.
    case 'VolumeAboveMaxLimit':
      return { code: 'CHAIN_KYC_LIMIT' };
    default:
      // BadAmount, TransferFailed and everything unknown are not in the table: INTERNAL, and
      // confirm asks findPaid before any retry (D-19).
      return { code: 'INTERNAL' };
  }
}

const asBig = (v: unknown): bigint => (typeof v === 'bigint' ? v : 0n);

const INSUFFICIENT = /insufficient funds|exceeds (the )?balance|insufficient balance/i;

/**
 * Anything a failed chain call threw, turned into one error code: revert bytes first, then the
 * RPC's wording for a wallet that cannot cover value plus gas. Unknown is INTERNAL.
 */
export function decodeChainFailure(error: unknown): DecodedChainError {
  const data = revertDataOf(error);
  if (data !== null) {
    const revert = decodeRevert(data);
    if (revert !== null) return chainErrorOf(revert);
  }
  const text =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`
      : '';
  if (INSUFFICIENT.test(text)) return { code: 'CHAIN_INSUFFICIENT_FUNDS' };
  return { code: 'INTERNAL' };
}
