import { randomBytes } from 'node:crypto';
import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { AgentKeyVault, parseMasterKey, type SealedKeyRow } from './agent-key-vault.js';
import { AgentKeysRepository } from './agent-keys.repository.js';

class MemoryStore {
  readonly rows = new Map<string, SealedKeyRow>();
  insert(row: SealedKeyRow) {
    this.rows.set(row.address, row);
  }
  find(address: string) {
    return this.rows.get(address);
  }
  findByAgentId(agentId: string) {
    return [...this.rows.values()].find((r) => r.agentId === agentId);
  }
  link(address: string, agentId: string) {
    const row = this.rows.get(address);
    if (row) this.rows.set(address, { ...row, agentId });
  }
}

describe('parseMasterKey', () => {
  it('takes 32 bytes of base64', () => {
    expect(parseMasterKey(randomBytes(32).toString('base64')).length).toBe(32);
  });

  it.each([
    undefined,
    '',
    'not-base64!!',
    randomBytes(16).toString('base64'),
    // 32 good bytes with junk characters mixed in: Buffer.from would skip them and accept.
    `${randomBytes(32).toString('base64').slice(0, 20)}!!${randomBytes(32).toString('base64').slice(20)}`,
    // non-canonical: the same 32 bytes with a stray newline and without padding
    `${randomBytes(32).toString('base64')}\n`.replace('=', ''),
  ])('refuses %j without echoing it', (raw) => {
    const err = (() => {
      try {
        parseMasterKey(raw);
      } catch (e) {
        return e;
      }
      return null;
    })();
    expect(err).toBeInstanceOf(AppError);
    if (raw) expect(JSON.stringify((err as AppError).detail)).not.toContain(raw);
  });
});

describe('AgentKeyVault', () => {
  const master = () => randomBytes(32);

  it('creates a key, stores only ciphertext, and signs as the returned address', async () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const address = vault.create('agent-1');
    const row = store.find(address);
    expect(row).toMatchObject({ address, agentId: 'agent-1', keyVersion: 1 });
    expect(row?.ciphertext).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.iv).toMatch(/^[0-9a-f]{24}$/);
    expect(row?.tag).toMatch(/^[0-9a-f]{32}$/);
    const opened = await vault.withAccount(address, (a) =>
      Promise.resolve(a.address.toLowerCase()),
    );
    expect(opened).toBe(address);
  });

  it('two keys differ and each has its own nonce', () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const a = vault.create();
    const b = vault.create();
    expect(a).not.toBe(b);
    expect(store.find(a)?.iv).not.toBe(store.find(b)?.iv);
  });

  it('refuses a wrong master key without leaking why', async () => {
    const store = new MemoryStore();
    const address = new AgentKeyVault(master(), store).create();
    const other = new AgentKeyVault(master(), store);
    const err = await other.withAccount(address, () => Promise.resolve(1)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INTERNAL');
  });

  it('refuses a ciphertext moved under another address (AAD)', async () => {
    const store = new MemoryStore();
    const m = master();
    const vault = new AgentKeyVault(m, store);
    const a = vault.create();
    const b = vault.create();
    const rowA = store.find(a);
    const rowB = store.find(b);
    if (!rowA || !rowB) throw new Error('rows missing');
    store.rows.set(b, { ...rowA, address: b });
    const err = await vault.withAccount(b, () => Promise.resolve(1)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
  });

  it('refuses a tampered tag and an unknown address', async () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const a = vault.create();
    const row = store.find(a);
    if (!row) throw new Error('row missing');
    store.rows.set(a, { ...row, tag: '00'.repeat(16) });
    await expect(vault.withAccount(a, () => Promise.resolve(1))).rejects.toBeInstanceOf(AppError);
    await expect(
      vault.withAccount('0x0000000000000000000000000000000000000001', () => Promise.resolve(1)),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a master key that is not 32 bytes', () => {
    expect(() => new AgentKeyVault(Buffer.alloc(16), new MemoryStore())).toThrow(AppError);
  });

  it('finds the key saved for an agents row, and nothing for another', () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const a = vault.create('row-1');
    expect(vault.addressFor('row-1')).toBe(a);
    expect(vault.addressFor('row-2')).toBeUndefined();
  });

  it('is case insensitive on the address and links an agent row', () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const a = vault.create();
    expect(vault.has(a.toUpperCase().replace('0X', '0x'))).toBe(true);
    vault.link(a, 'agent-9');
    expect(store.find(a)?.agentId).toBe('agent-9');
  });
});

describe('AgentKeysRepository (agent_keys, migration 0010)', () => {
  it('stores and finds a sealed key, and the address is unique', () => {
    const handle = openDb(':memory:');
    try {
      runMigrations(handle.db);
      const repo = new AgentKeysRepository(handle);
      const vault = new AgentKeyVault(randomBytes(32), repo);
      const address = vault.create();
      const row = repo.find(address);
      expect(row).toMatchObject({ address, agentId: null, keyVersion: 1 });
      if (!row) throw new Error('row missing');
      expect(() => {
        repo.insert(row);
      }).toThrow();
    } finally {
      handle.close();
    }
  });

  it('a second key for the same agents row is refused by the table (so callers reuse)', () => {
    const handle = openDb(':memory:');
    try {
      runMigrations(handle.db);
      const repo = new AgentKeysRepository(handle);
      const vault = new AgentKeyVault(randomBytes(32), repo);
      (handle.db as unknown as { $client: { pragma(s: string): void } }).$client.pragma(
        'foreign_keys = OFF',
      );
      const a = vault.create('row-1');
      expect(vault.addressFor('row-1')).toBe(a);
      expect(() => vault.create('row-1')).toThrow();
    } finally {
      handle.close();
    }
  });

  it('refuses a link to an agent row that does not exist (foreign key)', () => {
    const handle = openDb(':memory:');
    try {
      runMigrations(handle.db);
      const repo = new AgentKeysRepository(handle);
      const address = new AgentKeyVault(randomBytes(32), repo).create();
      expect(() => {
        repo.link(address, 'no-such-agent');
      }).toThrow();
    } finally {
      handle.close();
    }
  });
});
