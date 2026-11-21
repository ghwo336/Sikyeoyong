import { AppError, type AgentWallet } from '@sikyeoyong/shared';

/** The stored columns an AgentWallet is built from. */
export interface AgentWalletRow {
  readonly id: string;
  readonly walletAddress: string | null;
  readonly ownerAddress: string | null;
  readonly onchainAgentId: string | null;
}

export function asAddress(value: string | null): `0x${string}` | null {
  if (value === null) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new AppError('INTERNAL', { reason: 'stored agent wallet is not an address' });
  }
  return value as `0x${string}`;
}

/**
 * The one place a stored agent becomes an AgentWallet, so no caller can forget the
 * ERC-8004 id (path B needs it to write the TransferLimit). CHAIN_AGENT_LIMIT_UNSET
 * while the wallet or its owner is not written yet.
 */
export function agentWalletOf(row: AgentWalletRow): AgentWallet {
  const address = asAddress(row.walletAddress);
  const owner = asAddress(row.ownerAddress);
  if (address === null || owner === null) {
    throw new AppError('CHAIN_AGENT_LIMIT_UNSET', { reason: 'agent wallet not ready' });
  }
  return {
    agentRowId: row.id,
    address,
    ownerAddress: owner,
    ...(row.onchainAgentId === null ? {} : { onchainAgentId: BigInt(row.onchainAgentId) }),
  };
}
