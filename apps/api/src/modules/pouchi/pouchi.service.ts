import { Inject, Injectable } from '@nestjs/common';
import { AppError, type PouchiLoginConfig } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { POUCHI_BRIDGE, type PouchiBridge } from './pouchi-bridge.js';

/** How long a bound login may wait for its callback (Pouchi's own results expire sooner). */
export const POUCHI_PENDING_MS = 10 * 60 * 1000;
/** Pending logins kept at most; expired ones are dropped first (one process, D-03). */
const MAX_PENDING = 1000;

interface Pending {
  readonly flow: 'signup' | 'login';
  readonly expiresAt: number;
}

/**
 * The server half of the Pouchi login (D-29, Pouchi embedded quickstart "BFF"): the browser
 * binds each login request here before the vault opens, and the result comes back to the same
 * request once. The app key stays in the bridge; the browser only ever gets the public config.
 * Other modules use this service only; nothing else touches the SDK.
 */
@Injectable()
export class PouchiService {
  private readonly pending = new Map<string, Pending>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(POUCHI_BRIDGE) private readonly bridge: PouchiBridge,
  ) {}

  /** The login button's config. NOT_FOUND when Pouchi login is not set up (the web falls back). */
  loginConfig(): PouchiLoginConfig {
    const p = this.config.pouchi;
    if (p === undefined) throw new AppError('NOT_FOUND', { reason: 'pouchi login is off' });
    return {
      vaultUrl: p.vaultUrl,
      appId: p.appId,
      callbackUrl: `${this.config.publicBaseUrl}/pouchi/callback`,
    };
  }

  bind(requestId: string, flow: 'signup' | 'login', nowMs: number = Date.now()): void {
    this.loginConfig();
    for (const [id, p] of this.pending) if (p.expiresAt <= nowMs) this.pending.delete(id);
    if (this.pending.size >= MAX_PENDING) {
      throw new AppError('RATE_LIMITED', { reason: 'too many pending logins' });
    }
    if (this.pending.has(requestId)) {
      throw new AppError('CONFLICT', { reason: 'login request already bound' });
    }
    this.pending.set(requestId, { flow, expiresAt: nowMs + POUCHI_PENDING_MS });
  }

  /**
   * Redeems one bound request: once only, before it expires, and only when Pouchi says the
   * owner's device passed. Any refusal is UNAUTHENTICATED (the screen asks to try again).
   */
  async complete(
    body: { envelope: string; codeVerifier: string; requestId: string },
    nowMs: number = Date.now(),
  ): Promise<{ walletId: string; walletAddress: string }> {
    const p = this.pending.get(body.requestId);
    this.pending.delete(body.requestId);
    if (p === undefined || p.expiresAt <= nowMs) {
      throw new AppError('UNAUTHENTICATED', { reason: 'unknown, used or expired login request' });
    }
    const result = await this.bridge.complete({ ...body, flow: p.flow });
    if (!result.ok) {
      throw new AppError('UNAUTHENTICATED', { reason: `pouchi login ${result.outcome}` });
    }
    if (!result.ownerVerified) {
      throw new AppError('UNAUTHENTICATED', { reason: 'pouchi device check needed' });
    }
    return { walletId: result.walletId, walletAddress: result.walletAddress };
  }
}

export { POUCHI_BRIDGE, type PouchiBridge, type PouchiBridgeOutcome } from './pouchi-bridge.js';
