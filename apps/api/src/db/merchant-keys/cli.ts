import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { AppError, resolveChainConfig } from '@sikyeoyong/shared';
import { formatUnits } from 'viem';
import {
  executeSweep,
  loadSweepKeys,
  parseDestination,
  planSweep,
  readBalances,
  selectKeys,
  type SweepChain,
  type SweepKey,
} from './sweep.js';
import { createViemSweepChain } from './viem-chain.js';

// `pnpm merchants:balances` and `pnpm merchants:sweep` (D-33). Never prints private keys.

export const tokens = (wei: bigint): string => `${formatUnits(wei, 18)} tOKRW`;
const label = (k: SweepKey): string =>
  `${k.merchantKey}${k.source === 'archived' ? ' (archived)' : ''} ${k.address}`;

const USAGE = `usage:
  merchants:balances [--keys <dir>] [--merchant <key>]
  merchants:sweep --to <0x checksum address> (--merchant <key> | --all) [--dry-run] [--keys <dir>]`;

export interface CliDeps {
  readonly chain: SweepChain;
  readonly out: (line: string) => void;
}

export async function run(
  argv: readonly string[],
  deps: CliDeps,
  defaultKeysDir: string,
): Promise<void> {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      to: { type: 'string' },
      merchant: { type: 'string' },
      all: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      keys: { type: 'string' },
    },
    strict: true,
  });
  const keysDir = resolve(values.keys ?? defaultKeysDir);
  if (command === 'balances') {
    const keys = selectKeys(loadSweepKeys(keysDir), values.merchant);
    for (const { key, balance } of await readBalances(deps.chain, keys)) {
      deps.out(`${label(key)} ${tokens(balance)}`);
    }
    return;
  }
  if (command === 'sweep') {
    const to = parseDestination(values.to);
    if (!values.all && values.merchant === undefined) {
      throw new AppError('VALIDATION_FAILED', { reason: 'pass --merchant <key> or --all' });
    }
    const keys = selectKeys(loadSweepKeys(keysDir), values.all ? undefined : values.merchant);
    const rows = await planSweep(deps.chain, keys, to);
    if (values['dry-run']) {
      for (const r of rows) {
        const action = r.skip ? `skip (${r.skip})` : `would send ${tokens(r.amount)}`;
        deps.out(`${label(r.key)} balance ${tokens(r.balance)} fee ${tokens(r.fee)} ${action}`);
      }
      deps.out(`dry-run: nothing sent, to ${to}`);
      return;
    }
    for (const s of await executeSweep(deps.chain, rows, to)) {
      const r = s.row;
      const result = s.txHash
        ? `sent ${tokens(r.amount)} tx ${s.txHash}`
        : s.error
          ? `FAILED ${s.error}`
          : `skip (${r.skip})`;
      deps.out(`${label(r.key)} ${result}`);
    }
    return;
  }
  throw new AppError('VALIDATION_FAILED', { reason: USAGE });
}

if (require.main === module) {
  const root = resolve(__dirname, '../../../../..');
  const envFile = resolve(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const chainId = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined;
  const config = resolveChainConfig('maroo-testnet', {
    chainId,
    rpcUrl: process.env.MAROO_RPC_URL || undefined,
  });
  run(
    process.argv.slice(2),
    {
      chain: createViemSweepChain(config),
      out: (l) => {
        console.warn(l);
      },
    },
    resolve(root, 'seed/.keys'),
  ).catch((e: unknown) => {
    // AppError carries its reason in details; anything else prints only its name, never key text.
    const reason =
      e instanceof AppError ? JSON.stringify(e) : e instanceof Error ? e.name : 'unknown error';
    console.error(`merchant-keys: ${reason}\n${USAGE}`);
    process.exitCode = 1;
  });
}
