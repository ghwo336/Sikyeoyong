import { AppError, type PaymentProvider } from '@sikyeoyong/shared';
import { mockPeriodicVolume } from '../payment/payment.service.js';
import type { AppConfig } from '../../config/env.js';
import type { ChainReader } from './chain.service.js';
import { createOnchainChainReader } from './onchain-chain-reader.js';

/**
 * Path B reads the chain (contractPeriodicVolume, onchain-chain-reader.ts).
 * Development and tests read the mock chain's window when PAYMENT_PATH=mock (so paying fills
 * the 30-day line), else an empty window.
 * Production without a real reader (paths A and C are not wired) never pretends: every read
 * fails with INTERNAL, so a screen cannot show a made-up 30-day figure as if the chain said so.
 */
export function createChainReader(config: AppConfig, payment?: PaymentProvider): ChainReader {
  // Path B pays on the real chain, so the window is read from the chain. Outside production a
  // setup without a deployed proxy (the payment provider then pays nothing either) falls through
  // to the development window below; production stops the boot instead.
  if (payment?.path === 'B') {
    try {
      return createOnchainChainReader(config);
    } catch (e) {
      if (config.nodeEnv === 'production') throw e;
    }
  }
  if (config.nodeEnv === 'production') {
    return {
      periodicVolume: () =>
        Promise.reject(
          new AppError('INTERNAL', { reason: 'chain reader not wired for this payment path' }),
        ),
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
