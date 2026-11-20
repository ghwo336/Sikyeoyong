import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type OwnerAuthority, type PaymentProvider, zSetLevelResult } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agentLimitHistory, agents } from '../../db/schema/index.js';
import { insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { AgentsModule } from './agents.module.js';

// D-07 by hand: level 1 10,000, level 2 30,000, level 3 50,000 (aokrw = won * 10^18).
const W = (won: string) => `${won}000000000000000000`;

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1');
  const moduleRef = await Test.createTestingModule({ imports: [AgentsModule] })
    .useMocker((t) =>
      t === DB ? h : t === APP_CONFIG ? loadConfig({ PAYMENT_PATH: 'mock', ...env }) : undefined,
    )
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  // u1's dragon is hatched (fixture: ACTIVE, level 1); give it a mock wallet.
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const wallet = await payment.createAgent({ userId: 'u1', name: '용이' });
  h.db
    .update(agents)
    .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
    .where(eq(agents.id, 'a-u1'))
    .run();
  const token = moduleRef.get(AuthService).issue('u1', 'web');
  const http = () => request(app.getHttpServer() as Server);
  const setLevel = (level: unknown) =>
    http()
      .post('/api/agents/me/level')
      .set('Cookie', `sid=${token}`)
      .set('X-Requested-With', 'fetch')
      .send({ level });
  const row = () => h.db.select().from(agents).where(eq(agents.id, 'a-u1')).get();
  const history = () => h.db.select().from(agentLimitHistory).all();
  const owner = moduleRef.get<OwnerAuthority>(OWNER_AUTHORITY);
  return { h, http, setLevel, row, history, payment, owner, token };
}

describe('POST /api/agents/me/level (D-21, D-28)', () => {
  it('raises 1 to 3 with the button alone in REAUTH_MODE=none: the TransferLimit first, then the level', async () => {
    const { setLevel, row, history, payment } = await setup();
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await setLevel(3);
    expect(res.status).toBe(200);
    const body = zSetLevelResult.parse(res.body);
    expect(body).toMatchObject({ level: 3, perOrderLimit: W('50000') });
    expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[1]).toBe(BigInt(W('50000')));
    expect(row()?.level).toBe(3);
    expect(history().map((r) => [r.level, r.transferLimitAokrw, r.txHash])).toEqual([
      [3, W('50000'), body.txHash],
    ]);
  });

  it('lowers without re-auth, even in pouch mode', async () => {
    const { h, setLevel, row, history, payment } = await setup({ REAUTH_MODE: 'pouch' });
    h.db.update(agents).set({ level: 3 }).where(eq(agents.id, 'a-u1')).run();
    const write = vi.spyOn(payment, 'setTransferLimit');
    const res = await setLevel(2);
    expect(res.status).toBe(200);
    const body = zSetLevelResult.parse(res.body);
    expect(body.perOrderLimit).toBe(W('30000'));
    expect(write.mock.calls[0]?.[1]).toBe(BigInt(W('30000')));
    expect(row()?.level).toBe(2);
    expect(history().map((r) => [r.level, r.transferLimitAokrw, r.txHash])).toEqual([
      [2, W('30000'), body.txHash],
    ]);
  });

  it.each(['PENDING', 'REVOKED'] as const)(
    'a %s dragon is CHAIN_AGENT_LIMIT_UNSET: no chain write, nothing changes',
    async (status) => {
      const { h, setLevel, row, history, payment } = await setup();
      h.db.update(agents).set({ status }).where(eq(agents.id, 'a-u1')).run();
      const write = vi.spyOn(payment, 'setTransferLimit');
      const res = await setLevel(3);
      expect((res.body as { error: { code: string } }).error.code).toBe('CHAIN_AGENT_LIMIT_UNSET');
      expect(write).not.toHaveBeenCalled();
      expect(row()?.level).toBe(1);
      expect(history()).toHaveLength(0);
    },
  );

  it('when the owner must sign (signer user), the level does not change before the signature', async () => {
    const { setLevel, row, history, payment, owner } = await setup();
    vi.spyOn(owner, 'prepare').mockImplementation((action) =>
      Promise.resolve({ id: 'p1', action, signer: 'user' }),
    );
    const write = vi.spyOn(payment, 'setTransferLimit');
    expect((await setLevel(2)).status).toBe(500);
    expect(write).not.toHaveBeenCalled();
    expect(row()?.level).toBe(1);
    expect(history()).toHaveLength(0);
  });

  it('in pouch mode a raise waits for the owner wallet (Q-30): refused, nothing written', async () => {
    const { setLevel, row, history, payment } = await setup({ REAUTH_MODE: 'pouch' });
    const write = vi.spyOn(payment, 'setTransferLimit');
    expect((await setLevel(3)).status).toBe(500);
    expect(write).not.toHaveBeenCalled();
    expect(row()?.level).toBe(1);
    expect(history()).toHaveLength(0);
  });

  it('if the chain write fails, the level does not change', async () => {
    const { setLevel, row, history, payment } = await setup();
    vi.spyOn(payment, 'setTransferLimit').mockRejectedValueOnce(new Error('rpc down'));
    expect((await setLevel(3)).status).toBe(500);
    expect(row()?.level).toBe(1);
    expect(history()).toHaveLength(0);
  });

  it('the same level writes nothing; a frozen dragon is SERVER_FROZEN', async () => {
    const { h, setLevel, history, payment } = await setup();
    const write = vi.spyOn(payment, 'setTransferLimit');
    expect(zSetLevelResult.parse((await setLevel(1)).body).txHash).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(history()).toHaveLength(0);
    h.db.update(agents).set({ status: 'FROZEN' }).where(eq(agents.id, 'a-u1')).run();
    const frozen = await setLevel(3);
    expect((frozen.body as { error: { code: string } }).error.code).toBe('SERVER_FROZEN');
  });

  it('takes 1 to 3 only, needs a session and the fetch header', async () => {
    const { http, setLevel, token } = await setup();
    expect((await setLevel(4)).status).toBe(400);
    expect((await setLevel('3')).status).toBe(400);
    expect((await http().post('/api/agents/me/level').send({ level: 3 })).status).toBe(401);
    const noHeader = await http()
      .post('/api/agents/me/level')
      .set('Cookie', `sid=${token}`)
      .send({ level: 3 });
    expect(noHeader.status).toBe(403);
  });
});
