import type { AgentWallet, Hex } from './index.js';

/**
 * Owner-only actions (D-24, payment.md "소유자 서명 포트"). Today the operator
 * owns every agent (custodial); with the Pouch embedded SDK the user's own
 * wallet will (non-custodial). Callers never know which: they prepare an action
 * and confirm it, and only the OwnerAuthority decides who signs.
 */
export type OwnerMode = 'custodial' | 'pouch';

/** Every owner-only action (D-24). The API's prepare/confirm routes accept only these. */
export const OWNER_ACTION_KINDS = [
  'setTransferLimit',
  'bind',
  'pause',
  'unpause',
  'drain',
  'fund',
] as const;
export type OwnerActionKind = (typeof OWNER_ACTION_KINDS)[number];

export type OwnerAction =
  | { readonly kind: 'setTransferLimit'; readonly agent: AgentWallet; readonly amount: bigint }
  | { readonly kind: 'bind'; readonly agent: AgentWallet }
  | { readonly kind: 'pause'; readonly agent: AgentWallet }
  | { readonly kind: 'unpause'; readonly agent: AgentWallet }
  | { readonly kind: 'drain'; readonly agent: AgentWallet }
  | { readonly kind: 'fund'; readonly agent: AgentWallet; readonly amount: bigint };

/** A prepared action: who must sign it before confirm can finish it. */
export interface PreparedOwnerAction {
  readonly id: string;
  readonly action: OwnerAction;
  /** server: the custodial owner signs now. user: the web asks the user's wallet to sign. */
  readonly signer: 'server' | 'user';
}

export interface OwnerAuthority {
  readonly mode: OwnerMode;
  prepare(action: OwnerAction): Promise<PreparedOwnerAction>;
  /** signature is the user's, for signer 'user'; the custodial owner needs none. */
  confirm(prepared: PreparedOwnerAction, signature?: Hex): Promise<{ readonly txHashes: Hex[] }>;
}
