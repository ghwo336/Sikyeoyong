import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { sessions, users } from '../../db/schema/index.js';
import { AuthService, RECENT_LOGIN_MS, SESSION_TTL_MS } from './auth.service.js';
import { SessionsRepository } from './sessions.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const T0 = 1_767_000_000_000;

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '주인님', monthlyBudgetAokrw: '1', createdAt: 1 })
    .run();
  return { h, auth: new AuthService(new SessionsRepository(h)) };
}

describe('AuthService (tech-spec 9.4)', () => {
  it('issues a 32-byte token and stores only its SHA-256', () => {
    const { h, auth } = setup();
    const token = auth.issue('u1', 'web', T0);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    const rows = h.db.select().from(sessions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]?.expiresAt).toBe(T0 + SESSION_TTL_MS);
  });

  it('resolves a live token to its user and issue time', () => {
    const { auth } = setup();
    const token = auth.issue('u1', 'web', T0);
    expect(auth.resolve(token, T0 + 1)).toEqual({ userId: 'u1', issuedAt: T0 });
  });

  it('refuses expired, revoked, unknown and malformed tokens', () => {
    const { auth } = setup();
    const token = auth.issue('u1', 'web', T0);
    expect(auth.resolve(token, T0 + SESSION_TTL_MS)).toBeNull();
    expect(
      auth.resolve(
        auth.issue('u1', 'web', T0).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')),
        T0,
      ),
    ).toBeNull();
    expect(auth.resolve('', T0)).toBeNull();
    expect(auth.resolve("x' or 1=1 --", T0)).toBeNull();
    auth.revoke(token, T0 + 5);
    expect(auth.resolve(token, T0 + 6)).toBeNull();
  });

  it('gives different tokens each time', () => {
    const { auth } = setup();
    expect(auth.issue('u1', 'web', T0)).not.toBe(auth.issue('u1', 'web', T0));
  });

  it('counts a login as recent for 12 hours', () => {
    const { auth } = setup();
    const user = { userId: 'u1', issuedAt: T0 };
    expect(auth.isRecentLogin(user, T0 + RECENT_LOGIN_MS)).toBe(true);
    expect(auth.isRecentLogin(user, T0 + RECENT_LOGIN_MS + 1)).toBe(false);
  });
});
