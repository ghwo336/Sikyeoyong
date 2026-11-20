import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  parseRegisterArgs,
  readMetadataUris,
  readPayoutKeys,
  readSeedMerchants,
  requiredGasMoney,
  topUpAmount,
} from './merchants-plan.ts';

const base = ['--keys', 'k.json', '--db', 'x.db'];

describe('parseRegisterArgs', () => {
  it('defaults to the demo profile, 250 OKRW budget, real run', () => {
    const a = parseRegisterArgs(base);
    expect(a.profile).toBe('demo');
    expect(a.maxSpendOkrw).toBe(250n);
    expect(a.dryRun).toBe(false);
    expect(a.only).toEqual([]);
  });
  it('reads flags and values', () => {
    const a = parseRegisterArgs([...base, '--dry-run', '--only', 'a-01,b-02', '--max-spend', '5']);
    expect(a.dryRun).toBe(true);
    expect(a.only).toEqual(['a-01', 'b-02']);
    expect(a.maxSpendOkrw).toBe(5n);
  });
  it.each([[['--keys', 'k']], [[...base, '--x']], [[...base, '--max-spend', '1.5']]])(
    'rejects %j',
    (argv) => {
      expect(() => parseRegisterArgs(argv)).toThrow();
    },
  );
});

describe('gas money', () => {
  it('adds a 10 percent margin in bigint', () => {
    expect(requiredGasMoney(100n, 10n)).toBe(1100n);
  });
  it('tops up only the shortfall', () => {
    expect(topUpAmount(1100n, 0n)).toBe(1100n);
    expect(topUpAmount(1100n, 1000n)).toBe(100n);
    expect(topUpAmount(1100n, 1100n)).toBe(0n);
    expect(topUpAmount(1100n, 9999n)).toBe(0n);
  });
});

describe('readers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merchants-plan-'));
  it('reads seed merchants', () => {
    const p = join(dir, 'seed.json');
    writeFileSync(p, JSON.stringify({ merchants: [{ key: 'a', verified: true }] }));
    expect(readSeedMerchants(p)).toEqual([{ key: 'a', verified: true }]);
  });
  it('reads keys and never quotes a bad file', () => {
    const p = join(dir, 'keys.json');
    writeFileSync(p, JSON.stringify({ a: { privateKey: `0x${'1'.repeat(64)}` } }));
    expect(readPayoutKeys(p).get('a')).toBe(`0x${'1'.repeat(64)}`);
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{"a": {"privateKey": "0xSECRETSECRET');
    expect(() => readPayoutKeys(bad)).toThrow(/cannot be read/);
    try {
      readPayoutKeys(bad);
    } catch (e) {
      expect((e as Error).message).not.toContain('SECRET');
    }
  });
  it('reads metadata urls by lowercase payout address', () => {
    const p = join(dir, 'x.db');
    const db = new DatabaseSync(p);
    db.exec('create table merchants (payout_address text, metadata_uri text)');
    db.prepare('insert into merchants values (?, ?)').run('0xAbC', 'http://h/meta.json');
    db.close();
    expect(readMetadataUris(p).get('0xabc')).toBe('http://h/meta.json');
  });
});
