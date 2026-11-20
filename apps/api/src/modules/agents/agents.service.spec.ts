import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, users } from '../../db/schema/index.js';
import { AgentsRepository } from './agents.repository.js';
import { AgentsService } from './agents.service.js';
import type { AgentSetupService } from './agent-setup.service.js';
import { okrwToAokrw, type PaymentProvider } from '@sikyeoyong/shared';
import type { IdentityService } from '../identity/identity.service.js';
import { loadConfig } from '../../config/env.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '주인님', myPeriodicLimitAokrw: '1', createdAt: 1 })
    .run();
  h.db
    .insert(users)
    .values({ id: 'u2', nickname: '알만', myPeriodicLimitAokrw: '1', createdAt: 1 })
    .run();
  h.db
    .insert(agents)
    .values({
      id: 'a1',
      userId: 'u1',
      dragonName: '용이',
      dragonSpecies: 'water',
      paymentPath: 'B',
      perOrderLimitAokrw: '30000000000000000000000',
      createdAt: 1,
    })
    .run();
  // Reads only here: setup and payment are not reached by getForUser.
  const noSetup = { run: () => Promise.resolve() } as unknown as AgentSetupService;
  const noPayment = { path: 'mock' } as unknown as PaymentProvider;
  const verified = { isVerified: () => true } as unknown as IdentityService;
  return {
    h,
    s: new AgentsService(new AgentsRepository(h), noSetup, noPayment, verified, loadConfig({})),
  };
}

describe('AgentsService', () => {
  it('returns the per-order limit and not frozen for an active dragon', () => {
    const { h, s } = setup();
    h.db.update(agents).set({ status: 'ACTIVE' }).where(eq(agents.id, 'a1')).run();
    expect(s.getForUser('u1')).toEqual({
      id: 'a1',
      perOrderLimitAokrw: okrwToAokrw(30_000n),
      frozen: false,
      ready: true,
      wallet: null,
      dragonName: '용이',
      dragonSpecies: 'water',
      bornAt: 1,
    });
  });

  it.each([
    ['PENDING', false, false],
    ['ACTIVE', false, true],
    ['FROZEN', true, true],
    ['REVOKED', false, false],
  ] as const)('status %s reads as frozen=%s, ready=%s', (status, frozen, ready) => {
    const { h, s } = setup();
    h.db.update(agents).set({ status }).where(eq(agents.id, 'a1')).run();
    expect(s.getForUser('u1').frozen).toBe(frozen);
    expect(s.getForUser('u1').ready).toBe(ready);
  });

  it('returns the wallet once it exists, and refuses a malformed stored value', () => {
    const { h, s } = setup();
    const wallet = `0x${'ab'.repeat(20)}`;
    h.db.update(agents).set({ walletAddress: wallet }).where(eq(agents.id, 'a1')).run();
    expect(s.getForUser('u1').wallet).toBe(wallet);
    for (const bad of [
      'not-an-address',
      `0x${'a'.repeat(39)}`,
      `0x${'a'.repeat(41)}`,
      `0x${'g'.repeat(40)}`,
      'a'.repeat(42),
      'a'.repeat(40), // right length, no 0x
      `0X${'a'.repeat(40)}`,
    ]) {
      h.db.update(agents).set({ walletAddress: bad }).where(eq(agents.id, 'a1')).run();
      expect(() => s.getForUser('u1'), bad).toThrow(expect.objectContaining({ code: 'INTERNAL' }));
    }
  });

  it('answers NOT_FOUND when the user has no dragon yet', () => {
    const { s } = setup();
    expect(() => s.getForUser('u2')).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
});
