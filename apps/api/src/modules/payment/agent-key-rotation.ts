import type { AgentKeyVault, SealedKeyRow } from './agent-key-vault.js';

export type ResealedFields = Pick<
  SealedKeyRow,
  'ciphertext' | 'iv' | 'tag' | 'salt' | 'keyVersion'
>;

/** What the rotation needs from agent_keys beyond the vault's own store. */
export interface RotatableKeyStore {
  list(): SealedKeyRow[];
  /** One atomic swap of a row's seal; false when the row no longer holds `old`. */
  reseal(old: SealedKeyRow, next: ResealedFields): boolean;
}

export interface RotationReport {
  /** Already v2 under the current key. */
  readonly unchanged: number;
  /** Re-sealed (or, in a dry run, would be). */
  readonly rotated: number;
  /** Opened with neither key, or changed while the run was going. Addresses are public. */
  readonly failed: readonly string[];
}

/**
 * Re-seals every agent key as v2 under the current master key (security.md rotation). Safe to run
 * again: rows that are already done are left alone. One row at a time, one atomic swap per row, so
 * a stop in the middle leaves every row readable with the old or the new key. Keys and error
 * causes are never returned or printed; a failed row is reported by address only.
 */
export function rotateAgentKeys(
  vault: AgentKeyVault,
  store: RotatableKeyStore,
  options: { readonly dryRun: boolean },
): RotationReport {
  let unchanged = 0;
  let rotated = 0;
  const failed: string[] = [];
  for (const row of store.list()) {
    try {
      const next = vault.resealed(row);
      if (next === undefined) {
        unchanged += 1;
      } else if (options.dryRun || store.reseal(row, next)) {
        rotated += 1;
      } else {
        failed.push(row.address);
      }
    } catch {
      failed.push(row.address);
    }
  }
  return { unchanged, rotated, failed };
}
