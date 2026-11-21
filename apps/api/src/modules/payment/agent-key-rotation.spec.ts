import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { AppError } from '@sikyeoyong/shared';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { rotateAgentKeys } from './agent-key-rotation.js';
import { AgentKeyVault, parseMasterKeys } from './agent-key-vault.js';
import { AgentKeysRepository } from './agent-keys.repository.js';

// Fixed test keys (never a real .env value).
const key = (label: string): Buffer => createHash('sha256').update(`test-${label}`).digest();
const OLD = key('old');
const NEW = key('new');

function setup() {
  const handle = openDb(':memory:');
  runMigrations(handle.db);
  handle.sqlite.pragma('foreign_keys = OFF');
  return { handle, repo: new AgentKeysRepository(handle) };
}

/** Saves a v1 row (master key direct, no salt) like the ones production holds today. */
function insertV1(repo: AgentKeysRepository, master: Buffer): string {
  const priv = randomBytes(32);
  const address = privateKeyToAccount(`0x${priv.toString('hex')}`).address.toLowerCase();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', master, iv);
  cipher.setAAD(Buffer.from(address));
  const ciphertext = Buffer.concat([cipher.update(priv), cipher.final()]);
  repo.insert({
    address,
    agentId: null,
    onchainAgentId: '7',
    ciphertext: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    salt: null,
    keyVersion: 1,
    createdAt: 1,
  });
  return address;
}

describe('parseMasterKeys', () => {
  it('takes a current key and an optional previous one', () => {
    expect(parseMasterKeys(NEW.toString('base64'), undefined).previous).toBeUndefined();
    expect(parseMasterKeys(NEW.toString('base64'), '').previous).toBeUndefined();
    const b = parseMasterKeys(NEW.toString('base64'), OLD.toString('base64'));
    expect(b.previous?.equals(OLD)).toBe(true);
  });

  it('refuses a bad previous key naming only the variable', () => {
    const bad = 'not-base64!!';
    const err = (() => {
      try {
        parseMasterKeys(NEW.toString('base64'), bad);
      } catch (e) {
        return e as AppError;
      }
      throw new Error('should refuse');
    })();
    expect(JSON.stringify(err.detail)).toContain('AGENT_KEY_ENCRYPTION_KEY_PREVIOUS');
    expect(JSON.stringify(err.detail)).not.toContain(bad);
  });

  it('refuses a previous key equal to the current one', () => {
    expect(() => parseMasterKeys(NEW.toString('base64'), NEW.toString('base64'))).toThrow(AppError);
  });
});

describe('rotateAgentKeys', () => {
  it('re-seals rows under the new key; only the new key opens them; a rerun is a no-op', async () => {
    const { handle, repo } = setup();
    try {
      const oldVault = new AgentKeyVault(OLD, repo);
      const a = oldVault.create();
      const b = oldVault.create();
      const before = repo.find(a);
      const rotating = new AgentKeyVault(NEW, repo, Date.now, OLD);
      expect(rotateAgentKeys(rotating, repo, { dryRun: false })).toEqual({
        unchanged: 0,
        rotated: 2,
        failed: [],
      });
      const after = repo.find(a);
      expect(after?.keyVersion).toBe(2);
      expect(after?.ciphertext).not.toBe(before?.ciphertext);
      expect(after?.salt).not.toBe(before?.salt);
      const onlyNew = new AgentKeyVault(NEW, repo);
      for (const address of [a, b]) {
        const signer = await onlyNew.withAccount(address, (acc) => Promise.resolve(acc.address));
        expect(signer.toLowerCase()).toBe(address);
      }
      await expect(oldVault.withAccount(a, () => Promise.resolve(1))).rejects.toBeInstanceOf(
        AppError,
      );
      expect(rotateAgentKeys(rotating, repo, { dryRun: false })).toEqual({
        unchanged: 2,
        rotated: 0,
        failed: [],
      });
      expect(repo.find(a)).toEqual(after);
    } finally {
      handle.close();
    }
  });

  it('lifts v1 rows to v2 and keeps the rest of the row', async () => {
    const { handle, repo } = setup();
    try {
      const address = insertV1(repo, NEW);
      const vault = new AgentKeyVault(NEW, repo);
      expect(rotateAgentKeys(vault, repo, { dryRun: false }).rotated).toBe(1);
      expect(repo.find(address)).toMatchObject({ keyVersion: 2, onchainAgentId: '7' });
      const signer = await vault.withAccount(address, (acc) => Promise.resolve(acc.address));
      expect(signer.toLowerCase()).toBe(address);
    } finally {
      handle.close();
    }
  });

  it('a dry run counts but writes nothing', () => {
    const { handle, repo } = setup();
    try {
      new AgentKeyVault(OLD, repo).create();
      insertV1(repo, OLD);
      const snapshot = repo.list();
      const rotating = new AgentKeyVault(NEW, repo, Date.now, OLD);
      expect(rotateAgentKeys(rotating, repo, { dryRun: true }).rotated).toBe(2);
      expect(repo.list()).toEqual(snapshot);
    } finally {
      handle.close();
    }
  });

  it('reports a row neither key opens by address, keeps going, and leaves it untouched', () => {
    const { handle, repo } = setup();
    try {
      const stranger = new AgentKeyVault(key('stranger'), repo).create();
      const good = new AgentKeyVault(OLD, repo).create();
      const strangerRow = repo.find(stranger);
      const report = rotateAgentKeys(new AgentKeyVault(NEW, repo, Date.now, OLD), repo, {
        dryRun: false,
      });
      expect(report).toEqual({ unchanged: 0, rotated: 1, failed: [stranger] });
      expect(repo.find(stranger)).toEqual(strangerRow);
      expect(repo.find(good)?.keyVersion).toBe(2);
    } finally {
      handle.close();
    }
  });

  it('does not overwrite a row that changed after it was read (compare and swap)', () => {
    const { handle, repo } = setup();
    try {
      const a = new AgentKeyVault(OLD, repo).create();
      const stale = repo.find(a);
      if (!stale) throw new Error('row missing');
      const next = new AgentKeyVault(NEW, repo, Date.now, OLD).resealed(stale);
      if (!next) throw new Error('should rotate');
      expect(repo.reseal(stale, next)).toBe(true);
      expect(repo.reseal(stale, next)).toBe(false);
    } finally {
      handle.close();
    }
  });

  it('without a previous key, rows of the old key fail instead of being touched', () => {
    const { handle, repo } = setup();
    try {
      const a = new AgentKeyVault(OLD, repo).create();
      const report = rotateAgentKeys(new AgentKeyVault(NEW, repo), repo, { dryRun: false });
      expect(report.failed).toEqual([a]);
    } finally {
      handle.close();
    }
  });
});
