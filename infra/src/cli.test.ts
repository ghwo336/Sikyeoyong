import { describe, expect, it } from 'vitest';
import { parseArgs } from './cli.ts';

describe('parseArgs', () => {
  it('defaults to the default profile on the testnet, 300 OKRW budget, no force', () => {
    expect(parseArgs([])).toEqual({
      network: 'maroo-testnet',
      profile: 'default',
      force: false,
      check: false,
      skipBuild: false,
      maxSpendOkrw: 300n,
    });
  });

  it('reads flags and values', () => {
    const a = parseArgs(['--profile', 'demo', '--force', '--max-spend', '50']);
    expect(a.profile).toBe('demo');
    expect(a.force).toBe(true);
    expect(a.maxSpendOkrw).toBe(50n);
  });

  it.each([
    [['--profile', 'staging']],
    [['--network', 'mainnet']],
    [['--max-spend', '1.5']],
    [['--profile']],
    [['--unknown']],
    [['demo']],
  ])('rejects %j before anything is sent', (argv) => {
    expect(() => parseArgs(argv)).toThrow();
  });
});
