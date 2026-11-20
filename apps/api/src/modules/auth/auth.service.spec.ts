import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { sessions, users } from '../../db/schema/index.js';
import { AuthService } from './auth.service.js';
import { SessionsRepository } from './sessions.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const T0 = 1_767_000_000_000;
// tech-spec 9.4 values written by hand, not read from the implementation.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '주인님', myPeriodicLimitAokrw: '1', createdAt: 1 })
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
    expect(rows[0]?.expiresAt).toBe(T0 + 30 * DAY);
  });

  it('resolves a live token to its user and issue time', () => {
    const { auth } = setup();
    const token = auth.issue('u1', 'web', T0);
    expect(auth.resolve(token, T0 + 1)).toEqual({ userId: 'u1', issuedAt: T0 });
  });

  it('refuses expired, revoked, unknown and malformed tokens', () => {
    const { auth } = setup();
    const token = auth.issue('u1', 'web', T0);
    expect(auth.resolve(token, T0 + 30 * DAY - 1)?.userId).toBe('u1');
    expect(auth.resolve(token, T0 + 30 * DAY)).toBeNull();
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

  it('refuses tokens of the wrong shape without a DB lookup', () => {
    const repo = { insert: () => undefined, findLive: vi.fn(), revoke: () => undefined };
    const auth = new AuthService(repo as unknown as SessionsRepository);
    for (const bad of [
      'a'.repeat(42),
      'a'.repeat(44),
      `${'a'.repeat(42)}+`,
      `${'a'.repeat(42)}/`,
    ]) {
      expect(auth.resolve(bad, T0), bad).toBeNull();
    }
    expect(repo.findLive).not.toHaveBeenCalled();
  });

  it('gives different tokens each time', () => {
    const { auth } = setup();
    expect(auth.issue('u1', 'web', T0)).not.toBe(auth.issue('u1', 'web', T0));
  });

  it('counts a login as recent for 12 hours', () => {
    const { auth } = setup();
    const user = { userId: 'u1', issuedAt: T0 };
    expect(auth.isRecentLogin(user, T0 + 12 * HOUR)).toBe(true);
    expect(auth.isRecentLogin(user, T0 + 12 * HOUR + 1)).toBe(false);
  });
});
