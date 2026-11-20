import { AppError, type PaymentProvider } from '@sikyeoyong/shared';
import type { AppConfig } from '../../config/env.js';
import { MockPaymentProvider } from './mock-payment.provider.js';

/**
 * Other modules inject the provider by this token (architecture.md: payment is
 * reached through payment.service or payment.module only). The LLM module may
 * never import payment (code-style.md, D-06; the lint boundary enforces it).
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

const NOT_WIRED = (path: string) => () =>
  Promise.reject(new AppError('INTERNAL', { reason: `payment path ${path} not wired yet` }));

/** Picks the provider from PAYMENT_PATH (D-05). Paths A, B, C land with the contract and chain work. */
export function createPaymentProvider(config: AppConfig): PaymentProvider {
  const path = config.payment.path;
  if (path === 'mock') return new MockPaymentProvider(config.policy);
  const fail = NOT_WIRED(path);
  return {
    path,
    createAgent: fail,
    setTransferLimit: fail,
    bindAgent: fail,
    fund: fail,
    drain: fail,
    freeze: fail,
    unfreeze: fail,
    preflight: fail,
    pay: fail,
    findPaid: fail,
    balanceOf: fail,
  };
}

export {
  CustodialOwner,
  OWNER_AUTHORITY,
  createOwnerAuthority,
  runOwnerAction,
} from './owner-authority.js';

/**
 * Development only: the 30-day window the mock chain keeps, for the chain reader to show on the
 * budget and wallet screens. null for any real payment provider (the real reader reads the chain).
 */
export function mockPeriodicVolume(
  payment: PaymentProvider,
  address: `0x${string}`,
): { usedAokrw: bigint; resetAtSec: number | null } | null {
  return payment instanceof MockPaymentProvider ? payment.periodicVolume(address) : null;
}
