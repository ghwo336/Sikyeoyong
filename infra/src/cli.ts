import {
  isNetworkKey,
  isPolicyProfile,
  type NetworkKey,
  type PolicyProfile,
} from '@sikyeoyong/shared';

export interface CliArgs {
  readonly network: NetworkKey;
  readonly profile: PolicyProfile;
  readonly force: boolean;
  readonly check: boolean;
  readonly skipBuild: boolean;
  /** Gas budget in whole OKRW. The CLI stops before a write that would pass it. */
  readonly maxSpendOkrw: bigint;
}

const FLAGS = new Set(['--force', '--check', '--skip-build']);
const VALUES = new Set(['--profile', '--network', '--max-spend']);

/** Strict parser: an unknown flag stops the run before anything is sent. */
export function parseArgs(argv: readonly string[]): CliArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    if (FLAGS.has(arg)) flags.add(arg);
    else if (VALUES.has(arg)) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${arg} needs a value`);
      values.set(arg, next);
      i += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  const profile = values.get('--profile') ?? 'default';
  if (!isPolicyProfile(profile)) throw new Error(`unknown profile: ${profile}`);
  const network = values.get('--network') ?? 'maroo-testnet';
  if (!isNetworkKey(network)) throw new Error(`unknown network: ${network}`);
  const spend = values.get('--max-spend') ?? '300';
  if (!/^[1-9][0-9]{0,6}$/.test(spend)) throw new Error('--max-spend must be a whole OKRW amount');
  return {
    network,
    profile,
    force: flags.has('--force'),
    check: flags.has('--check'),
    skipBuild: flags.has('--skip-build'),
    maxSpendOkrw: BigInt(spend),
  };
}
