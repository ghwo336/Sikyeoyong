import { randomUUID } from 'node:crypto';
import {
  AppError,
  type Hex,
  type OwnerAction,
  type OwnerAuthority,
  type PaymentProvider,
  type PreparedOwnerAction,
} from '@sikyeoyong/shared';
import type { AppConfig } from '../../config/env.js';

/** Inject with this token; only modules that act as the owner (agents, later orders) import it. */
export const OWNER_AUTHORITY = Symbol('OWNER_AUTHORITY');

/**
 * Custodial owner (D-24, now): the operator owns every agent, so the server
 * signs. prepare says "server", and confirm carries the action out through the
 * payment path at once.
 */
export class CustodialOwner implements OwnerAuthority {
  readonly mode = 'custodial' as const;

  constructor(private readonly payment: PaymentProvider) {}

  prepare(action: OwnerAction): Promise<PreparedOwnerAction> {
    return Promise.resolve({ id: randomUUID(), action, signer: 'server' });
  }

  async confirm(prepared: PreparedOwnerAction): Promise<{ txHashes: Hex[] }> {
    const a = prepared.action;
    switch (a.kind) {
      case 'setTransferLimit':
        return { txHashes: [await this.payment.setTransferLimit(a.agent, a.amount)] };
      case 'bind':
        return { txHashes: [await this.payment.bindAgent(a.agent)] };
      case 'pause':
        return { txHashes: await this.payment.freeze(a.agent) };
      case 'unpause':
        return { txHashes: await this.payment.unfreeze(a.agent) };
      case 'drain':
        return { txHashes: await this.payment.drain(a.agent) };
      case 'fund':
        return { txHashes: [await this.payment.fund(a.agent, a.amount)] };
    }
  }
}

/**
 * Pouch owner (D-24, later): the user's Pouch wallet owns the agent and signs
 * on the device after reauth. The server only prepares the transaction; it can
 * never sign. Until the embedded SDK ships (Q-30) every call fails, so nothing
 * pretends to be non-custodial.
 */
export class PouchOwner implements OwnerAuthority {
  readonly mode = 'pouch' as const;

  prepare(): Promise<PreparedOwnerAction> {
    return Promise.reject(
      new AppError('INTERNAL', { reason: 'pouch owner not available yet (Q-30)' }),
    );
  }

  confirm(): Promise<{ txHashes: Hex[] }> {
    return Promise.reject(
      new AppError('INTERNAL', { reason: 'pouch owner not available yet (Q-30)' }),
    );
  }
}

export function createOwnerAuthority(config: AppConfig, payment: PaymentProvider): OwnerAuthority {
  return config.payment.ownerMode === 'pouch' ? new PouchOwner() : new CustodialOwner(payment);
}

/**
 * Prepare and, when the server is the signer, confirm at once. When the user
 * must sign, it returns the prepared action for the web to take to the wallet
 * (the confirm step then arrives with the signature through an API).
 */
export async function runOwnerAction(
  owner: OwnerAuthority,
  action: OwnerAction,
): Promise<{ done: true; txHashes: Hex[] } | { done: false; prepared: PreparedOwnerAction }> {
  const prepared = await owner.prepare(action);
  if (prepared.signer === 'user') return { done: false, prepared };
  return { done: true, ...(await owner.confirm(prepared)) };
}
