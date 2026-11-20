import { DEPLOYMENTS, findDeployment, resolveOrdersContract, type Hex } from '@sikyeoyong/shared';
import type { AppConfig } from '../../config/env.js';

/** Where SikyeoyongOrders lives: the proxy and the block to start reading events from. */
export interface OrdersTarget {
  readonly proxy: Hex;
  readonly deployBlock: bigint;
}

/**
 * The proxy from ORDERS_CONTRACT or the deployment record for this chain and policy profile
 * (CLAUDE.md rule 2: addresses only come from shared config). Throws INTERNAL when nobody
 * deployed one, so a screen never runs against a made-up address.
 */
export function resolveOrdersTarget(config: AppConfig): OrdersTarget {
  const { chainId } = config.chain;
  const profile = config.policy.profile;
  const proxy = resolveOrdersContract(
    DEPLOYMENTS,
    chainId,
    profile,
    config.orders.contractOverride,
  );
  const record = findDeployment(DEPLOYMENTS, chainId, profile);
  const fromRecord = record !== null && record.proxy.toLowerCase() === proxy.toLowerCase();
  const deployBlock = config.orders.deployBlockOverride ?? (fromRecord ? record.deployBlock : 0);
  return { proxy, deployBlock: BigInt(deployBlock) };
}
