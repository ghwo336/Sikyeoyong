import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { AppError, type Hex } from '@sikyeoyong/shared';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

/** One sealed key as stored (agent_keys). All fields hex except the numbers. */
export interface SealedKeyRow {
  readonly address: string;
  readonly agentId: string | null;
  /** The 8004 id (decimal string) once register() succeeded. */
  readonly onchainAgentId: string | null;
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
  /** HKDF salt (hex) of a v2 row; null on a v1 row. */
  readonly salt: string | null;
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
  /** Remembers the 8004 id so a retried hatch does not register a second one. */
  setOnchainAgentId(address: string, onchainAgentId: string): void;
}

/** v1: the master key seals directly. v2: a per-row HKDF-SHA256 key (security.md). */
const KEY_VERSION_MASTER_DIRECT = 1;
const KEY_VERSION_HKDF = 2;
const IV_BYTES = 12;
const SALT_BYTES = 16;
const HKDF_INFO = 'sikyeoyong/agent-key/v2';

/** The v2 encryption key of one agent: HKDF-SHA256(master, row salt, info + address). */
function deriveAgentKey(master: Buffer, salt: Buffer, address: string): Buffer {
  return Buffer.from(hkdfSync('sha256', master, salt, `${HKDF_INFO}${address}`, 32));
}

/** Parses a master key variable (32 bytes, base64). The error names the variable, never the value. */
export function parseMasterKey(
  raw: string | undefined,
  variable = 'AGENT_KEY_ENCRYPTION_KEY',
): Buffer {
  const key = raw === undefined ? Buffer.alloc(0) : Buffer.from(raw, 'base64');
  // Buffer.from skips bad characters; only the canonical encoding of the 32 bytes is accepted.
  if (key.length !== 32 || key.toString('base64') !== raw) {
    throw new AppError('INTERNAL', {
      reason: `${variable} must be 32 bytes, base64`,
      variables: [variable],
    });
  }
  return key;
}

/** The master keys of a rotation: the current one and, optionally, the one it replaces. */
export interface MasterKeys {
  readonly current: Buffer;
  readonly previous: Buffer | undefined;
}

/**
 * Parses AGENT_KEY_ENCRYPTION_KEY and the optional AGENT_KEY_ENCRYPTION_KEY_PREVIOUS (an empty
 * value counts as unset). A previous key equal to the current one is a mistake, not a rotation.
 */
export function parseMasterKeys(
  current: string | undefined,
  previous: string | undefined,
): MasterKeys {
  const cur = parseMasterKey(current);
  if (previous === undefined || previous === '') return { current: cur, previous: undefined };
  const prev = parseMasterKey(previous, 'AGENT_KEY_ENCRYPTION_KEY_PREVIOUS');
  if (prev.equals(cur)) {
    throw new AppError('INTERNAL', {
      reason: 'AGENT_KEY_ENCRYPTION_KEY_PREVIOUS must differ from AGENT_KEY_ENCRYPTION_KEY',
      variables: ['AGENT_KEY_ENCRYPTION_KEY_PREVIOUS'],
    });
  }
  return { current: cur, previous: prev };
}

/**
 * Path B key custody (payment.md, tech-spec 3.4). Agent EOA keys are made here, sealed with
 * AES-256-GCM under a per-agent key (HKDF of the master key, a random per-row salt and the
 * address; v2, v1 rows sealed with the master key directly still open) and saved before the caller does anything on chain. A key is decrypted only for the
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
    /** The key a rotation is replacing. Only used to open rows; nothing is ever sealed with it. */
    private readonly previousKey?: Buffer,
  ) {
    if (masterKey.length !== 32 || (previousKey !== undefined && previousKey.length !== 32)) {
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
      this.store.insert({
        address,
        agentId: agentId ?? null,
        onchainAgentId: null,
        ...this.seal(priv, address),
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

  /** The 8004 id saved for this wallet, if register() already succeeded for it. */
  onchainAgentIdOf(address: string): bigint | undefined {
    const raw = this.store.find(address.toLowerCase())?.onchainAgentId;
    return raw === null || raw === undefined ? undefined : BigInt(raw);
  }

  recordOnchainAgentId(address: string, onchainAgentId: bigint): void {
    this.store.setOnchainAgentId(address.toLowerCase(), onchainAgentId.toString());
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

  /** Seals a plaintext key as a v2 row (fresh salt and nonce). */
  protected seal(
    priv: Buffer,
    address: string,
  ): Pick<SealedKeyRow, 'ciphertext' | 'iv' | 'tag' | 'salt' | 'keyVersion'> {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const key = deriveAgentKey(this.masterKey, salt, address);
    try {
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(address));
      const ciphertext = Buffer.concat([cipher.update(priv), cipher.final()]);
      return {
        ciphertext: ciphertext.toString('hex'),
        iv: iv.toString('hex'),
        tag: cipher.getAuthTag().toString('hex'),
        salt: salt.toString('hex'),
        keyVersion: KEY_VERSION_HKDF,
      };
    } finally {
      key.fill(0);
    }
  }

  private open(row: SealedKeyRow): Buffer {
    return this.openWith(row).priv;
  }

  /**
   * Opens a row with the current master key, then with the previous one if there is one. The cause
   * of a failure (wrong key or a tampered row) is not echoed: it could hint at the key.
   */
  private openWith(row: SealedKeyRow): { priv: Buffer; usedPrevious: boolean } {
    if (row.keyVersion !== KEY_VERSION_MASTER_DIRECT && row.keyVersion !== KEY_VERSION_HKDF) {
      throw new AppError('INTERNAL', { reason: 'unknown agent key version' });
    }
    const current = openRow(row, this.masterKey);
    if (current !== undefined) return { priv: current, usedPrevious: false };
    const previous = this.previousKey && openRow(row, this.previousKey);
    if (previous) return { priv: previous, usedPrevious: true };
    throw new AppError('INTERNAL', { reason: 'agent key could not be opened' });
  }

  /**
   * Rotation: the row re-sealed as v2 under the current master key, or undefined when it already
   * is one (v2 and opens with the current key alone). Throws when the row opens with neither key.
   * The new seal is opened again before it is returned; the plaintext is zeroed on every path.
   */
  resealed(
    row: SealedKeyRow,
  ): Pick<SealedKeyRow, 'ciphertext' | 'iv' | 'tag' | 'salt' | 'keyVersion'> | undefined {
    const { priv, usedPrevious } = this.openWith(row);
    try {
      if (row.keyVersion === KEY_VERSION_HKDF && !usedPrevious) return undefined;
      const next = this.seal(priv, row.address);
      const check = this.openWith({ ...row, ...next });
      const same = check.priv.equals(priv);
      check.priv.fill(0);
      if (!same || check.usedPrevious) {
        throw new AppError('INTERNAL', { reason: 'agent key re-seal did not verify' });
      }
      return next;
    } finally {
      priv.fill(0);
    }
  }
}

/** One AES-256-GCM open attempt with `master` as the master key of the row's version. */
function openRow(row: SealedKeyRow, master: Buffer): Buffer | undefined {
  let key: Buffer;
  if (row.keyVersion === KEY_VERSION_MASTER_DIRECT) key = master;
  else if (row.salt !== null)
    key = deriveAgentKey(master, Buffer.from(row.salt, 'hex'), row.address);
  else return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(row.iv, 'hex'));
    decipher.setAAD(Buffer.from(row.address));
    decipher.setAuthTag(Buffer.from(row.tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(row.ciphertext, 'hex')), decipher.final()]);
  } catch {
    return undefined;
  } finally {
    if (key !== master) key.fill(0);
  }
}
