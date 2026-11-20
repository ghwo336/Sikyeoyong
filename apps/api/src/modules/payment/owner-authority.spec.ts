import {
  getPolicy,
  type OwnerAuthority,
  okrwToAokrw,
  type PreparedOwnerAction,
} from '@sikyeoyong/shared';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import {
  CustodialOwner,
  createOwnerAuthority,
  PouchOwner,
  runOwnerAction,
} from './owner-authority.js';

async function agentOf(p: MockPaymentProvider) {
  return p.createAgent({ userId: 'u1', name: '용이' });
}

describe('OwnerAuthority (D-24)', () => {
  it('custodial: the server signs; every owner action reaches the payment path', async () => {
    const p = new MockPaymentProvider(getPolicy('default'));
    const spies = {
      setTransferLimit: vi.spyOn(p, 'setTransferLimit'),
      bindAgent: vi.spyOn(p, 'bindAgent'),
      freeze: vi.spyOn(p, 'freeze'),
      unfreeze: vi.spyOn(p, 'unfreeze'),
      drain: vi.spyOn(p, 'drain'),
      fund: vi.spyOn(p, 'fund'),
    };
    const owner = new CustodialOwner(p);
    const agent = await agentOf(p);
    const limit = okrwToAokrw(10_000n);
    for (const action of [
      { kind: 'setTransferLimit', agent, amount: limit },
      { kind: 'bind', agent },
      { kind: 'pause', agent },
      { kind: 'unpause', agent },
      { kind: 'fund', agent, amount: limit },
      { kind: 'drain', agent },
    ] as const) {
      const prepared = await owner.prepare(action);
      expect(prepared.signer).toBe('server');
      const { txHashes } = await owner.confirm(prepared);
      expect(txHashes.length).toBeGreaterThan(0);
    }
    expect(spies.setTransferLimit).toHaveBeenCalledExactlyOnceWith(agent, limit);
    expect(spies.bindAgent).toHaveBeenCalledOnce();
    expect(spies.freeze).toHaveBeenCalledOnce();
    expect(spies.unfreeze).toHaveBeenCalledOnce();
    expect(spies.fund).toHaveBeenCalledExactlyOnceWith(agent, limit);
    expect(spies.drain).toHaveBeenCalledOnce();
  });

  it('prepare alone changes nothing on chain (two steps, D-24)', async () => {
    const p = new MockPaymentProvider(getPolicy('default'));
    const fund = vi.spyOn(p, 'fund');
    const agent = await agentOf(p);
    await new CustodialOwner(p).prepare({ kind: 'fund', agent, amount: 1n });
    expect(fund).not.toHaveBeenCalled();
    expect(await p.balanceOf(agent.address)).toBe(0n);
  });

  it('pouch: never signs on the server and fails until the SDK ships (Q-30)', async () => {
    const p = new MockPaymentProvider(getPolicy('default'));
    const agent = await agentOf(p);
    const owner = new PouchOwner();
    await expect(owner.prepare()).rejects.toMatchObject({ code: 'INTERNAL' });
    await expect(owner.confirm()).rejects.toMatchObject({ code: 'INTERNAL' });
    await expect(runOwnerAction(owner, { kind: 'bind', agent })).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });

  it('runOwnerAction hands back a user-signed action instead of confirming it', async () => {
    const confirm = vi.fn();
    const userSigned: OwnerAuthority = {
      mode: 'pouch',
      prepare: (action) =>
        Promise.resolve({ id: 'x', action, signer: 'user' } as PreparedOwnerAction),
      confirm,
    };
    const p = new MockPaymentProvider(getPolicy('default'));
    const agent = await agentOf(p);
    const r = await runOwnerAction(userSigned, { kind: 'pause', agent });
    expect(r).toEqual({
      done: false,
      prepared: { id: 'x', action: { kind: 'pause', agent }, signer: 'user' },
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('OWNER_MODE picks the implementation', () => {
    const p = new MockPaymentProvider(getPolicy('default'));
    expect(createOwnerAuthority(loadConfig({}), p).mode).toBe('custodial');
    expect(createOwnerAuthority(loadConfig({ OWNER_MODE: 'pouch' }), p).mode).toBe('pouch');
  });
});
