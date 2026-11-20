import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type SessionPlatform, SessionsRepository } from './sessions.repository.js';

/** tech-spec 9.4: sessions live 30 days; sensitive actions need a login within 12 hours. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const RECENT_LOGIN_MS = 12 * 60 * 60 * 1000;

/** Who is calling, from the session. Tool handlers and controllers take the user only from here. */
export interface SessionUser {
  readonly userId: string;
  /** unix ms the session was issued (for the 12-hour recent-login rule). */
  readonly issuedAt: number;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Issues, resolves and revokes sessions. The token is 32 random bytes; only its hash is stored. */
@Injectable()
export class AuthService {
  constructor(private readonly repo: SessionsRepository) {}

  issue(userId: string, platform: SessionPlatform, nowMs: number = Date.now()): string {
    const token = randomBytes(32).toString('base64url');
    this.repo.insert({ id: hashToken(token), userId, platform, expiresAt: nowMs + SESSION_TTL_MS });
    return token;
  }

  /** The user behind a token, or null for unknown, expired or revoked tokens. */
  resolve(token: string, nowMs: number = Date.now()): SessionUser | null {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const row = this.repo.findLive(hashToken(token), nowMs);
    if (row === undefined) return null;
    return { userId: row.userId, issuedAt: row.expiresAt - SESSION_TTL_MS };
  }

  /**
   * A login: the browser's previous session (if any) ends and a new one starts, so one
   * browser never holds two live sids (auth.md). Every login route uses this.
   */
  rotate(
    previous: string | null,
    userId: string,
    platform: SessionPlatform,
    nowMs: number = Date.now(),
  ): string {
    if (previous !== null) this.revoke(previous, nowMs);
    return this.issue(userId, platform, nowMs);
  }

  revoke(token: string, nowMs: number = Date.now()): void {
    this.repo.revoke(hashToken(token), nowMs);
  }

  isRecentLogin(user: SessionUser, nowMs: number = Date.now()): boolean {
    return nowMs - user.issuedAt <= RECENT_LOGIN_MS;
  }
}
