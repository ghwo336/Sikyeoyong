import { okrwToAokrw } from '@sikyeoyong/shared';
import { Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, users } from '../../db/schema/index.js';
import { loadConfig } from '../../config/env.js';
import { createOwnerAuthority, createPaymentProvider } from '../payment/payment.service.js';
import { AgentLimitService } from './agent-limit.service.js';
import { AgentSetupService } from './agent-setup.service.js';
import { AgentsRepository } from './agents.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  vi.restoreAllMocks();
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
  const repo = new AgentsRepository(h);
  repo.insert({
    id: 'a1',
    userId: 'u1',
    dragonName: '용이',
    dragonSpecies: 'water',
    paymentPath: 'B',
    perOrderLimitAokrw: '10000000000000000000000',
    createdAt: 1,
  });
  // The mock refuses setTransferLimit without the 8004 id, like the real path B.
  const config = loadConfig({ PAYMENT_PATH: 'mock' });
  const payment = createPaymentProvider(config);
  const owner = createOwnerAuthority(config, payment);
  const row = () => h.db.select().from(agents).where(eq(agents.id, 'a1')).get();
  return { h, repo, payment, owner, row, setup: new AgentSetupService(payment, owner, repo) };
}

describe('AgentSetupService hands the 8004 id to the TransferLimit write', () => {
  it('hatches a new dragon: the id the wallet step stored reaches setTransferLimit', async () => {
    const { setup: s, payment, row } = setup();
    const spy = vi.spyOn(payment, 'setTransferLimit');
    await s.run('a1');
    expect(row()?.status).toBe('ACTIVE');
    expect(spy.mock.calls[0]?.[0].onchainAgentId).toBe(BigInt(row()?.onchainAgentId ?? '-1'));
  });

  it('resumes a dragon whose wallet was saved earlier: the id comes from the row', async () => {
    const { setup: s, payment, repo, row } = setup();
    const created = await payment.createAgent({ userId: 'u1', name: '용이' });
    repo.saveWallet('a1', {
      address: created.address,
      onchainAgentId: String(created.onchainAgentId),
      ownerAddress: created.ownerAddress,
    });
    await s.run('a1');
    expect(row()?.status).toBe('ACTIVE');
  });

  it('parks the dragon at failed when the row has no id (no silent success)', async () => {
    const { setup: s, payment, repo, row } = setup();
    const created = await payment.createAgent({ userId: 'u1', name: '용이' });
    repo.saveWallet('a1', {
      address: created.address,
      onchainAgentId: null,
      ownerAddress: created.ownerAddress,
    });
    await s.run('a1');
    expect(row()?.status).toBe('PENDING');
    expect(row()?.setupStep).toBe('failed');
  });
});

describe('AgentSetupService failure log', () => {
  it('logs the error code and reason, never a key-like field', async () => {
    const { setup: s, payment, repo } = setup();
    const created = await payment.createAgent({ userId: 'u1', name: '용이' });
    repo.saveWallet('a1', {
      address: created.address,
      onchainAgentId: null,
      ownerAddress: created.ownerAddress,
    });
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await s.run('a1');
    const line = String(error.mock.calls[0]?.[0]);
    expect(line).toContain('INTERNAL');
    expect(line).toContain('8004 id');
    expect(line).toContain('at limit');
  });
});

describe('AgentLimitService hands the 8004 id to the TransferLimit write', () => {
  it('writes the changed limit with the id from the row, and refuses a row without it', async () => {
    const { setup: s, payment, owner, repo, row, h } = setup();
    await s.run('a1');
    const limit = new AgentLimitService(owner, repo);
    const spy = vi.spyOn(payment, 'setTransferLimit');
    await limit.write('u1', okrwToAokrw(20_000n), 2);
    expect(spy.mock.calls[0]?.[0].onchainAgentId).toBe(BigInt(row()?.onchainAgentId ?? '-1'));
    h.db.update(agents).set({ onchainAgentId: null }).where(eq(agents.id, 'a1')).run();
    await expect(limit.write('u1', okrwToAokrw(30_000n), 3)).rejects.toThrow();
  });
});
