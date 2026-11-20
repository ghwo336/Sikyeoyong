import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { appendToArchive, archivePath, ensurePayoutKeys, readArchive } from './payout-keys.js';

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'keys-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('key archive (D-33)', () => {
  it('archives every new key with modes 700 / 600', () => {
    const dir = tmp();
    const file = join(dir, 'merchants.json');
    ensurePayoutKeys(file, ['a', 'b']);
    const entries = readArchive(join(dir, 'archive'));
    expect(entries.map((e) => e.merchantKey)).toEqual(['a', 'b']);
    expect(entries[0]?.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(statSync(join(dir, 'archive')).mode & 0o777).toBe(0o700);
    expect(statSync(archivePath(join(dir, 'archive'))).mode & 0o777).toBe(0o600);
  });

  it('only appends: earlier bytes never change and reruns add nothing', () => {
    const dir = tmp();
    const file = join(dir, 'merchants.json');
    ensurePayoutKeys(file, ['a']);
    const path = archivePath(join(dir, 'archive'));
    const before = readFileSync(path, 'utf8');
    ensurePayoutKeys(file, ['a']);
    expect(readFileSync(path, 'utf8')).toBe(before);
    ensurePayoutKeys(file, ['a', 'b']);
    const after = readFileSync(path, 'utf8');
    expect(after.startsWith(before)).toBe(true);
    expect(after.trim().split('\n')).toHaveLength(2);
  });

  it('keeps a key whose merchant left the seed', () => {
    const dir = tmp();
    const file = join(dir, 'merchants.json');
    ensurePayoutKeys(file, ['a', 'b']);
    ensurePayoutKeys(file, ['a']);
    expect(
      readArchive(join(dir, 'archive'))
        .map((e) => e.merchantKey)
        .sort(),
    ).toEqual(['a', 'b']);
  });

  it('backfills keys that existed before the archive', () => {
    const dir = tmp();
    const file = join(dir, 'merchants.json');
    ensurePayoutKeys(file, ['a']);
    rmSync(join(dir, 'archive'), { recursive: true });
    ensurePayoutKeys(file, ['a']);
    expect(readArchive(join(dir, 'archive'))).toHaveLength(1);
  });

  it('appendToArchive skips known private keys', () => {
    const dir = tmp();
    const keys = { a: { privateKey: `0x${'11'.repeat(32)}` } };
    expect(appendToArchive(dir, keys)).toBe(1);
    expect(appendToArchive(dir, keys)).toBe(0);
  });

  it('a broken archive line fails without quoting key text', () => {
    const dir = tmp();
    const secret = `0x${'22'.repeat(32)}`;
    writeFileSync(join(dir, 'keys.jsonl'), `{"privateKey":"${secret}",\n`);
    let caught: unknown;
    try {
      readArchive(dir);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(JSON.stringify(caught)).toContain('invalid line');
    expect(JSON.stringify(caught)).not.toContain(secret);
  });
});
