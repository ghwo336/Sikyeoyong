import { AppError } from '@sikyeoyong/shared';
import type { AppConfig } from '../../config/env.js';
import type { ChainReader } from './chain.service.js';

/**
 * Until SikyeoyongOrders is deployed there is nothing on chain to read.
 * Development and tests get an empty window (no orders on chain yet).
 * Production never pretends: every read fails with INTERNAL until the real
 * viem reader is wired (worklog follow-up), so a screen cannot show a made-up
 * 30-day figure as if the chain said so.
 */
export function createChainReader(config: AppConfig): ChainReader {
  if (config.nodeEnv === 'production') {
    return {
      periodicVolume: () =>
        Promise.reject(new AppError('INTERNAL', { reason: 'chain reader not wired yet' })),
    };
  }
  return { periodicVolume: () => Promise.resolve({ usedAokrw: 0n, resetAtSec: null }) };
}
