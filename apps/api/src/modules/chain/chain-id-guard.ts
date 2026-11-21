import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { AppError, type PaymentProvider } from '@sikyeoyong/shared';
import { createMarooPublicClient } from '../../common/onchain/clients.js';
import { resolveOrdersTarget } from '../../common/onchain/orders-target.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { PAYMENT_PROVIDER } from '../payment/payment.service.js';

/** The slice of a public client the check uses (eth_chainId). */
export interface ChainIdPort {
  getChainId(): Promise<number>;
}

/**
 * The testnet chain id will change (decisions D-05, chain-and-pcl.md MUST): the id in shared
 * config must be the one the RPC answers, or every signed transaction targets another chain.
 * A mismatch refuses the boot. This runs wherever a real chain is used: path B with a deployed
 * orders proxy. The mock path never touches a chain. A development setup with no proxy (the
 * provider pays nothing there) is skipped. When the RPC cannot be asked, production refuses (the
 * id cannot be verified) and development warns.
 */
export async function verifyChainId(
  config: AppConfig,
  payment: PaymentProvider,
  port: ChainIdPort,
  warn: (message: string) => void = () => undefined,
): Promise<void> {
  if (payment.path !== 'B') return;
  try {
    resolveOrdersTarget(config);
  } catch (e) {
    if (config.nodeEnv === 'production' || !(e instanceof AppError)) throw e;
    return;
  }
  let actual: number;
  try {
    actual = await port.getChainId();
  } catch (e) {
    if (config.nodeEnv === 'production') {
      throw new AppError('INTERNAL', {
        reason: 'could not read eth_chainId from the RPC, so the chain id is unverified',
        cause: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
      });
    }
    warn('eth_chainId could not be read, chain id not verified (development)');
    return;
  }
  if (actual !== config.chain.chainId) {
    throw new AppError('INTERNAL', {
      reason: `the RPC answers chain id ${String(actual)} but the configured chain id is ${String(config.chain.chainId)}`,
      variables: ['CHAIN_ID', 'MAROO_RPC_URL'],
    });
  }
}

/** Boot hook: a rejected hook stops the Nest start, so a wrong chain never serves. */
@Injectable()
export class ChainIdGuard implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChainIdGuard.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(PAYMENT_PROVIDER) private readonly payment: PaymentProvider,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await verifyChainId(
      this.config,
      this.payment,
      { getChainId: () => createMarooPublicClient(this.config.chain).getChainId() },
      (m) => {
        this.logger.warn(m);
      },
    );
  }
}
