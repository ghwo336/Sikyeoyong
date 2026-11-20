import type { Hex } from '@sikyeoyong/shared';
import { createMarooPublicClient } from '../../common/onchain/clients.js';
import { PLACE_ORDER_SELECTOR } from '../../common/onchain/orders-abi.js';
import { resolveOrdersTarget } from '../../common/onchain/orders-target.js';
import type { AppConfig } from '../../config/env.js';
import type { ChainReader } from './chain.service.js';

/** One contractPeriodicVolume status as the PCL precompile returns it. */
export interface PeriodicVolumeStatus {
  readonly amount: bigint;
  readonly maxAmount: bigint;
  readonly resetPeriodSeconds: bigint;
  readonly resetAt: bigint;
}

/** The slice of the SDK's pcl actions the reader uses (a port, so tests need no network). */
export interface PclPort {
  contractPeriodicVolume(args: {
    contract: Hex;
    user: Hex;
    selector: Hex;
    asset: string;
    resetPeriodSeconds: bigint;
    resolveAgentOwners: boolean;
  }): Promise<readonly PeriodicVolumeStatus[]>;
}

/**
 * The real reader for path B (maroo-facts 3.2): contractPeriodicVolume(proxy, agent wallet,
 * placeOrder selector, denom). The 30-day window opens with the first order, so a wallet with
 * nothing counted has no resetAt (null). When the precompile returns several statuses the one
 * with our period wins.
 */
export function createOnchainChainReader(config: AppConfig, pcl?: PclPort): ChainReader {
  const target = resolveOrdersTarget(config);
  const port = pcl ?? createMarooPublicClient(config.chain).pcl;
  const period = BigInt(config.policy.periodicPeriodSec);
  return {
    async periodicVolume(wallet) {
      if (wallet === null) return { usedAokrw: 0n, resetAtSec: null };
      const statuses = await port.contractPeriodicVolume({
        contract: target.proxy,
        user: wallet,
        selector: PLACE_ORDER_SELECTOR,
        asset: config.chain.okrwDenom,
        resetPeriodSeconds: period,
        resolveAgentOwners: false,
      });
      const status = statuses.find((s) => s.resetPeriodSeconds === period) ?? statuses[0];
      if (status === undefined) return { usedAokrw: 0n, resetAtSec: null };
      return {
        usedAokrw: status.amount,
        resetAtSec: status.resetAt === 0n ? null : Number(status.resetAt),
      };
    },
  };
}
