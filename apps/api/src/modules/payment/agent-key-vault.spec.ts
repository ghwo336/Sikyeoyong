import { createCipheriv, randomBytes } from 'node:crypto';
import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
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
  setOnchainAgentId(address: string, onchainAgentId: string) {
    const row = this.rows.get(address);
    if (row) this.rows.set(address, { ...row, onchainAgentId });
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
    expect(row).toMatchObject({ address, agentId: 'agent-1', keyVersion: 2 });
    expect(row?.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(row?.ciphertext).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.iv).toMatch(/^[0-9a-f]{24}$/);
    expect(row?.tag).toMatch(/^[0-9a-f]{32}$/);
    const opened = await vault.withAccount(address, (a) =>
      Promise.resolve(a.address.toLowerCase()),
    );
    expect(opened).toBe(address);
  });

  /** A pre-HKDF row: the master key seals directly, no salt (what production holds today). */
  function legacyRow(m: Buffer): { row: SealedKeyRow; priv: `0x${string}` } {
    const priv = generatePrivateKey();
    const address = privateKeyToAccount(priv).address.toLowerCase();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', m, iv);
    cipher.setAAD(Buffer.from(address));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(priv.slice(2), 'hex')),
      cipher.final(),
    ]);
    return {
      priv,
      row: {
        address,
        agentId: null,
        onchainAgentId: null,
        ciphertext: ciphertext.toString('hex'),
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        salt: null,
        keyVersion: 1,
        createdAt: 1,
      },
    };
  }

  it('still opens a v1 row sealed with the master key directly', async () => {
    const store = new MemoryStore();
    const m = master();
    const { row, priv } = legacyRow(m);
    store.insert(row);
    const vault = new AgentKeyVault(m, store);
    const signer = await vault.withAccount(row.address, (a) => Promise.resolve(a.address));
    expect(signer.toLowerCase()).toBe(row.address);
    expect(privateKeyToAccount(priv).address.toLowerCase()).toBe(row.address);
  });

  it('gives each v2 row its own salt, and the salt is part of the key', async () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const a = vault.create();
    const b = vault.create();
    expect(store.find(a)?.salt).not.toBe(store.find(b)?.salt);
    const row = store.find(a);
    if (!row) throw new Error('row missing');
    store.rows.set(a, { ...row, salt: randomBytes(16).toString('hex') });
    await expect(vault.withAccount(a, () => Promise.resolve(1))).rejects.toBeInstanceOf(AppError);
    store.rows.set(a, { ...row, salt: null });
    await expect(vault.withAccount(a, () => Promise.resolve(1))).rejects.toBeInstanceOf(AppError);
  });

  it('refuses an unknown key version', async () => {
    const store = new MemoryStore();
    const vault = new AgentKeyVault(master(), store);
    const a = vault.create();
    const row = store.find(a);
    if (!row) throw new Error('row missing');
    store.rows.set(a, { ...row, keyVersion: 3 });
    await expect(vault.withAccount(a, () => Promise.resolve(1))).rejects.toBeInstanceOf(AppError);
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
      expect(row).toMatchObject({ address, agentId: null, keyVersion: 2 });
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

  it('keeps the 8004 id across reads, in the real table too', () => {
    const handle = openDb(':memory:');
    try {
      runMigrations(handle.db);
      const vault = new AgentKeyVault(randomBytes(32), new AgentKeysRepository(handle));
      const address = vault.create();
      expect(vault.onchainAgentIdOf(address)).toBeUndefined();
      vault.recordOnchainAgentId(address, 123_456_789_012_345_678_901n);
      expect(vault.onchainAgentIdOf(address.toUpperCase().replace('0X', '0x'))).toBe(
        123_456_789_012_345_678_901n,
      );
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
