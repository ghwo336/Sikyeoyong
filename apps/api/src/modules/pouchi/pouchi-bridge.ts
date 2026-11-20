/**
 * The port to Pouchi's bridge result check (D-29). The real one wraps @nc-waas/sdk/server
 * (sdk-pouchi-bridge.ts); tests use a fake. Nothing outside the pouchi module sees the SDK.
 */
export interface PouchiBridgeInput {
  readonly envelope: string;
  readonly codeVerifier: string;
  readonly requestId: string;
  readonly flow: 'signup';
}

export type PouchiBridgeOutcome =
  | {
      readonly ok: true;
      /** The owner device passed Pouchi's check (false: device add or restore still needed). */
      readonly ownerVerified: boolean;
      readonly walletId: string;
      readonly walletAddress: string;
    }
  | { readonly ok: false; readonly outcome: 'cancelled' | 'failed'; readonly error: string | null };

export interface PouchiBridge {
  complete(input: PouchiBridgeInput): Promise<PouchiBridgeOutcome>;
}

export const POUCHI_BRIDGE = Symbol('POUCHI_BRIDGE');
