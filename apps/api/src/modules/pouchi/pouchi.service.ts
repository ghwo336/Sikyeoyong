import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppError, type PouchiLoginConfig } from '@sikyeoyong/shared';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { POUCHI_BRIDGE, type PouchiBridge } from './pouchi-bridge.js';

/** How long a bound login may wait for its callback (the Pouchi BFF example: 10 minutes). */
export const POUCHI_PENDING_MS = 10 * 60 * 1000;
/** Pending logins kept at most, a memory floor only; the per-IP limit is the real gate. */
export const MAX_PENDING = 1000;
/** tech-spec 9.5: login calls per IP. */
export const POUCHI_IP_RULE = { limit: 10, windowMs: 60_000 } as const;

interface Pending {
  readonly codeChallenge: string;
  readonly expiresAt: number;
}

/** base64url(SHA-256(verifier)) against the stored challenge, in constant time. */
function verifierMatches(verifier: string, challenge: string): boolean {
  const made = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const kept = Buffer.from(challenge);
  return made.length === kept.length && timingSafeEqual(made, kept);
}

/**
 * The server half of the Pouchi login (D-29, the Pouchi BFF example "최소 BFF 로그인"): the
 * browser binds each login request and its PKCE challenge here before the vault opens; the
 * result comes back to the same request once, its verifier must match the challenge, and only
 * then does the bridge check the signed result. The app key stays in the bridge; the browser
 * only gets the public config. Other modules use this service only.
 */
@Injectable()
export class PouchiService {
  private readonly pending = new Map<string, Pending>();
  /** Overridable in tests; production keeps MAX_PENDING. */
  maxPending = MAX_PENDING;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(POUCHI_BRIDGE) private readonly bridge: PouchiBridge,
    private readonly limiter: RateLimiter,
  ) {}

  /** The login button's config. NOT_FOUND when Pouchi login is not set up. */
  loginConfig(): PouchiLoginConfig {
    const p = this.config.pouchi;
    if (p === undefined) throw new AppError('NOT_FOUND', { reason: 'pouchi login is off' });
    return {
      vaultUrl: p.vaultUrl,
      appId: p.appId,
      callbackUrl: `${this.config.publicBaseUrl}/pouchi/callback`,
    };
  }

  bind(requestId: string, codeChallenge: string, ip: string, nowMs: number = Date.now()): void {
    this.loginConfig();
    this.limit(ip, nowMs);
    for (const [id, p] of this.pending) if (p.expiresAt <= nowMs) this.pending.delete(id);
    if (this.pending.size >= this.maxPending) {
      throw new AppError('RATE_LIMITED', { reason: 'too many pending logins' });
    }
    if (this.pending.has(requestId)) {
      throw new AppError('CONFLICT', { reason: 'login request already bound' });
    }
    this.pending.set(requestId, { codeChallenge, expiresAt: nowMs + POUCHI_PENDING_MS });
  }

  /**
   * Redeems one bound request: once only (taken before anything else, so a failed try cannot
   * be retried), before it expires, with the verifier that matches its challenge, and only when
   * Pouchi says the owner's device passed. Any refusal is UNAUTHENTICATED.
   */
  async complete(
    body: { requestId: string; envelope: string; codeVerifier: string },
    ip: string,
    nowMs: number = Date.now(),
  ): Promise<{ walletId: string; walletAddress: string }> {
    this.limit(ip, nowMs);
    const p = this.pending.get(body.requestId);
    this.pending.delete(body.requestId);
    if (p === undefined || p.expiresAt <= nowMs) {
      throw new AppError('UNAUTHENTICATED', { reason: 'unknown, used or expired login request' });
    }
    if (!verifierMatches(body.codeVerifier, p.codeChallenge)) {
      throw new AppError('UNAUTHENTICATED', { reason: 'verifier does not match the challenge' });
    }
    const result = await this.bridge.complete({ ...body, flow: 'signup' });
    if (!result.ok) {
      throw new AppError('UNAUTHENTICATED', { reason: `pouchi login ${result.outcome}` });
    }
    if (!result.ownerVerified) {
      throw new AppError('UNAUTHENTICATED', { reason: 'pouchi device check needed' });
    }
    return { walletId: result.walletId, walletAddress: result.walletAddress };
  }

  private limit(ip: string, nowMs: number): void {
    if (!this.limiter.allow(`pouchi:${ip}`, POUCHI_IP_RULE, nowMs)) {
      throw new AppError('RATE_LIMITED', { reason: 'too many login calls from this address' });
    }
  }
}

export { POUCHI_BRIDGE, type PouchiBridge, type PouchiBridgeOutcome } from './pouchi-bridge.js';
