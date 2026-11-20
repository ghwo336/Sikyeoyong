import { AppError, type PaymentProvider } from '@sikyeoyong/shared';
import type { AppConfig } from '../../config/env.js';
import type { AgentKeyStore } from './agent-key-vault.js';
import { createManagedEoaProvider } from './managed-eoa.factory.js';
import { MockPaymentProvider } from './mock-payment.provider.js';

/**
 * Other modules inject the provider by this token (architecture.md: payment is
 * reached through payment.service or payment.module only). The LLM module may
 * never import payment (code-style.md, D-06; the lint boundary enforces it).
 */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

const NOT_WIRED = (reason: string) => () => Promise.reject(new AppError('INTERNAL', { reason }));

/** A provider that pays nothing: every call is INTERNAL with the reason. */
function unavailable(path: PaymentProvider['path'], reason: string): PaymentProvider {
  const fail = NOT_WIRED(reason);
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

/**
 * Picks the provider from PAYMENT_PATH (D-05). Path B is the managed EOA provider (D-25). It
 * needs OPERATOR_KEY, AGENT_KEY_ENCRYPTION_KEY and a deployed orders proxy. In production a
 * missing piece stops the boot (nothing unsafe starts); in development and tests it leaves a
 * provider that pays nothing, so the rest of the app still runs. Paths A and C are not wired:
 * every call fails with INTERNAL and nothing is paid.
 */
export function createPaymentProvider(
  config: AppConfig,
  keyStore?: AgentKeyStore,
): PaymentProvider {
  const path = config.payment.path;
  if (path === 'mock') return new MockPaymentProvider(config.policy);
  if (path === 'B') {
    try {
      if (keyStore === undefined) {
        throw new AppError('INTERNAL', { reason: 'payment path B needs the agent key store' });
      }
      return createManagedEoaProvider(config, keyStore);
    } catch (e) {
      if (config.nodeEnv === 'production' || !(e instanceof AppError)) throw e;
      return unavailable(
        'B',
        'payment path B is not set up here (operator key, vault key, orders proxy)',
      );
    }
  }
  return unavailable(path, `payment path ${path} not wired yet`);
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
