import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AOKRW_PER_OKRW } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from './cli.js';
import { ensurePayoutKeys } from './payout-keys.js';
import {
  executeSweep,
  loadSweepKeys,
  parseDestination,
  planSweep,
  type SweepChain,
} from './sweep.js';

const TO = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'sweep-'));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fakeChain(balances: Record<string, bigint>, gas = 21_000n, price = 1_000n) {
  const sent: { value: bigint; to: string; privateKey: string }[] = [];
  const chain: SweepChain = {
    balanceOf: (a) => Promise.resolve(balances[a] ?? 0n),
    gasPrice: () => Promise.resolve(price),
    estimateGas: () => Promise.resolve(gas),
    send: (args) => {
      sent.push({ value: args.value, to: args.to, privateKey: args.privateKey });
      return Promise.resolve(`0x${'ab'.repeat(32)}`);
    },
  };
  return { chain, sent };
}

describe('parseDestination', () => {
  it('requires --to', () => {
    expect(() => parseDestination(undefined)).toThrow();
    expect(() => parseDestination('')).toThrow();
  });
  it('rejects non-addresses and bad checksums', () => {
    expect(() => parseDestination('0x123')).toThrow();
    expect(() => parseDestination(TO.replace('5aAe', '5AAe'))).toThrow();
  });
  it('accepts checksum and all-lowercase addresses', () => {
    expect(parseDestination(TO)).toBe(TO);
    expect(parseDestination(TO.toLowerCase())).toBe(TO);
  });
});

describe('plan and execute', () => {
  function setup() {
    const dir = tmp();
    ensurePayoutKeys(join(dir, 'merchants.json'), ['a', 'b', 'c']);
    const keys = loadSweepKeys(dir);
    return { dir, keys };
  }

  it('sends balance minus gas × price, skips zero and too-small balances', async () => {
    const { keys } = setup();
    const [a, b, c] = keys;
    if (!a || !b || !c) throw new Error('keys');
    const { chain, sent } = fakeChain({
      [a.address]: AOKRW_PER_OKRW,
      [b.address]: 0n,
      [c.address]: 21_000n * 1_000n,
    });
    const rows = await planSweep(chain, keys, TO);
    expect(rows.map((r) => r.skip)).toEqual([null, 'zero-balance', 'insufficient-for-gas']);
    expect(rows[0]?.amount).toBe(AOKRW_PER_OKRW - 21_000_000n);
    expect(rows[0]?.fee).toBe(21_000_000n);
    const result = await executeSweep(chain, rows, TO);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.value).toBe(AOKRW_PER_OKRW - 21_000_000n);
    expect(sent[0]?.to).toBe(TO);
    expect(result.filter((r) => r.txHash)).toHaveLength(1);
  });

  it('one failing wallet does not stop the rest and the key is not echoed', async () => {
    const { keys } = setup();
    const balances = Object.fromEntries(keys.map((k) => [k.address, AOKRW_PER_OKRW]));
    const { chain } = fakeChain(balances);
    const first = keys[0];
    if (!first) throw new Error('keys');
    let n = 0;
    const flaky: SweepChain = {
      ...chain,
      send: (args) => {
        n += 1;
        if (n === 1) return Promise.reject(new Error(`boom ${args.privateKey}\nmore`));
        return Promise.resolve('0xhash');
      },
    };
    const out = await executeSweep(flaky, await planSweep(flaky, keys, TO), TO);
    expect(out[0]?.error).toBe('boom [key]');
    expect(out.slice(1).every((s) => s.txHash === '0xhash')).toBe(true);
  });
});

describe('keys', () => {
  it('a merchant removed from the seed is still swept via the archive', () => {
    const dir = tmp();
    const file = join(dir, 'merchants.json');
    ensurePayoutKeys(file, ['a', 'gone']);
    ensurePayoutKeys(file, ['a']);
    // The live file no longer has "gone" (seed dropped it); the archive still does.
    writeFileSync(file, JSON.stringify({}));
    const after = loadSweepKeys(dir);
    expect(after.map((k) => k.merchantKey).sort()).toEqual(['a', 'gone']);
    expect(after.every((k) => k.source === 'archived')).toBe(true);
  });

  it('works with only the archive (no merchants.json)', () => {
    const dir = tmp();
    ensurePayoutKeys(join(dir, 'merchants.json'), ['a']);
    rmSync(join(dir, 'merchants.json'));
    expect(loadSweepKeys(dir)).toHaveLength(1);
  });

  it('missing keys dir yields no keys', () => {
    const dir = tmp();
    mkdirSync(join(dir, 'empty'));
    expect(loadSweepKeys(join(dir, 'empty'))).toEqual([]);
  });
});

describe('cli', () => {
  function setup(): {
    dir: string;
    out: string[];
    deps: Parameters<typeof run>[1];
    sent: unknown[];
  } {
    const dir = tmp();
    ensurePayoutKeys(join(dir, 'merchants.json'), ['a']);
    const key = loadSweepKeys(dir)[0];
    if (!key) throw new Error('keys');
    const { chain, sent } = fakeChain({ [key.address]: AOKRW_PER_OKRW });
    const out: string[] = [];
    return { dir, out, sent, deps: { chain, out: (l) => out.push(l) } };
  }

  it('sweep without --to fails and sends nothing', async () => {
    const s = setup();
    await expect(run(['sweep', '--all'], s.deps, s.dir)).rejects.toThrow();
    expect(s.sent).toHaveLength(0);
  });

  it('sweep needs --merchant or --all', async () => {
    const s = setup();
    await expect(run(['sweep', '--to', TO], s.deps, s.dir)).rejects.toThrow();
  });

  it('dry-run prints amounts, never a private key, and sends nothing', async () => {
    const s = setup();
    await run(['sweep', '--to', TO, '--all', '--dry-run'], s.deps, s.dir);
    expect(s.sent).toHaveLength(0);
    const text = s.out.join('\n');
    expect(text).toContain('would send 0.999999999979 tOKRW');
    expect(text).not.toMatch(/0x[0-9a-f]{64}/);
  });

  it('real run sends once', async () => {
    const s = setup();
    await run(['sweep', '--to', TO, '--merchant', 'a', '--keys', s.dir], s.deps, '/nowhere');
    expect(s.sent).toHaveLength(1);
  });

  it('balances lists address and balance only', async () => {
    const s = setup();
    await run(['balances'], s.deps, s.dir);
    expect(s.out).toHaveLength(1);
    expect(s.out[0]).toMatch(/^a 0x[0-9a-fA-F]{40} 1 tOKRW$/);
  });
});
