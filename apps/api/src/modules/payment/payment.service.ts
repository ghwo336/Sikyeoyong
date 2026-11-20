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
