import { AppError, type PaymentProvider } from '@sikyeoyong/shared';
import { mockPeriodicVolume } from '../payment/payment.service.js';
import type { AppConfig } from '../../config/env.js';
import type { ChainReader } from './chain.service.js';

/**
 * Until SikyeoyongOrders is deployed there is nothing on chain to read.
 * Development and tests read the mock chain's window when PAYMENT_PATH=mock (so paying fills
 * the 30-day line), else an empty window.
 * Production never pretends: every read fails with INTERNAL until the real
 * viem reader is wired (worklog follow-up), so a screen cannot show a made-up
 * 30-day figure as if the chain said so.
 */
export function createChainReader(config: AppConfig, payment?: PaymentProvider): ChainReader {
  if (config.nodeEnv === 'production') {
    return {
      periodicVolume: () =>
        Promise.reject(new AppError('INTERNAL', { reason: 'chain reader not wired yet' })),
    };
  }
  // PAYMENT_PATH=mock: read the mock chain's own window, so paying fills the 30-day line.
  return {
    periodicVolume: (wallet) => {
      const fromMock =
        payment === undefined || wallet === null ? null : mockPeriodicVolume(payment, wallet);
      return Promise.resolve(fromMock ?? { usedAokrw: 0n, resetAtSec: null });
    },
  };
}
