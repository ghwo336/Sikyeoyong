import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { AppError, type Hex } from '@sikyeoyong/shared';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

/** One sealed key as stored (agent_keys). All fields hex except the numbers. */
export interface SealedKeyRow {
  readonly address: string;
  readonly agentId: string | null;
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
  readonly keyVersion: number;
  readonly createdAt: number;
}

/** Where sealed keys live. The vault never sees a plaintext key outside its own methods. */
export interface AgentKeyStore {
  insert(row: SealedKeyRow): void;
  find(address: string): SealedKeyRow | undefined;
  findByAgentId(agentId: string): SealedKeyRow | undefined;
  /** Links a saved key to its agents row. */
  link(address: string, agentId: string): void;
}

const KEY_VERSION = 1;
const IV_BYTES = 12;

/** Parses AGENT_KEY_ENCRYPTION_KEY (32 bytes, base64). The error names the variable, never the value. */
export function parseMasterKey(raw: string | undefined): Buffer {
  const key = raw === undefined ? Buffer.alloc(0) : Buffer.from(raw, 'base64');
  // Buffer.from skips bad characters; only the canonical encoding of the 32 bytes is accepted.
  if (key.length !== 32 || key.toString('base64') !== raw) {
    throw new AppError('INTERNAL', {
      reason: 'AGENT_KEY_ENCRYPTION_KEY must be 32 bytes, base64',
      variables: ['AGENT_KEY_ENCRYPTION_KEY'],
    });
  }
  return key;
}

/**
 * Path B key custody (payment.md, tech-spec 3.4). Agent EOA keys are made here, sealed with
 * AES-256-GCM and saved before the caller does anything on chain. A key is decrypted only for the
 * duration of one callback; the buffer is zeroed right after (the hex string viem needs lives as
 * long as the account object, so this is best effort). The address is the GCM additional data, so
 * a ciphertext copied under another address fails to open. Nothing is logged here; errors carry
 * no key material.
 */
export class AgentKeyVault {
  constructor(
    private readonly masterKey: Buffer,
    private readonly store: AgentKeyStore,
    private readonly now: () => number = Date.now,
  ) {
    if (masterKey.length !== 32) {
      throw new AppError('INTERNAL', { reason: 'vault master key must be 32 bytes' });
    }
  }

  /**
   * The key already saved for this agents row, if any. A retried hatch reuses it: the key may hold
   * funds, so it is never replaced or dropped.
   */
  addressFor(agentId: string): Hex | undefined {
    return this.store.findByAgentId(agentId)?.address as Hex | undefined;
  }

  /** Makes a new key, saves it sealed, returns only the address. */
  create(agentId?: string): Hex {
    const priv = Buffer.from(generatePrivateKey().slice(2), 'hex');
    try {
      const address = privateKeyToAccount(`0x${priv.toString('hex')}`).address.toLowerCase();
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
      cipher.setAAD(Buffer.from(address));
      const ciphertext = Buffer.concat([cipher.update(priv), cipher.final()]);
      this.store.insert({
        address,
        agentId: agentId ?? null,
        ciphertext: ciphertext.toString('hex'),
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        keyVersion: KEY_VERSION,
        createdAt: this.now(),
      });
      return address as Hex;
    } finally {
      priv.fill(0);
    }
  }

  has(address: string): boolean {
    return this.store.find(address.toLowerCase()) !== undefined;
  }

  link(address: string, agentId: string): void {
    this.store.link(address.toLowerCase(), agentId);
  }

  /** Runs `fn` with the agent's signing account. The plaintext buffer is zeroed when it returns. */
  async withAccount<T>(
    address: string,
    fn: (account: PrivateKeyAccount) => Promise<T>,
  ): Promise<T> {
    const row = this.store.find(address.toLowerCase());
    if (row === undefined) {
      throw new AppError('INTERNAL', { reason: 'no key for this agent wallet' });
    }
    const priv = this.open(row);
    try {
      return await fn(privateKeyToAccount(`0x${priv.toString('hex')}`));
    } finally {
      priv.fill(0);
    }
  }

  private open(row: SealedKeyRow): Buffer {
    if (row.keyVersion !== KEY_VERSION) {
      throw new AppError('INTERNAL', { reason: 'unknown agent key version' });
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(row.iv, 'hex'));
      decipher.setAAD(Buffer.from(row.address));
      decipher.setAuthTag(Buffer.from(row.tag, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'hex')), decipher.final()]);
    } catch {
      // The cause (wrong master key or a tampered row) is not echoed: it could hint at the key.
      throw new AppError('INTERNAL', { reason: 'agent key could not be opened' });
    }
  }
}
