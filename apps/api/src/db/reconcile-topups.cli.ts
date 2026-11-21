/**
 * pnpm topups:reconcile -- --dry-run | --run [--older-than <minutes>]
 *
 * Owner-run (payment.md "즉시 충전(fund)의 멱등성"). Lists fund holds of the owner allowance that
 * have no tx hash and are older than the bound (default 30 minutes). A hold whose order has no
 * top-up marker was provably never sent and is released (--run) or only listed (--dry-run). Holds
 * whose top-up may have been sent are only reported. Nothing is re-sent. Prints ids, amounts and
 * counts, never keys. Exit 0 when nothing is left to look at, 1 when ambiguous holds remain.
 */
import { parseArgs } from 'node:util';
import { formatOkrw } from '@sikyeoyong/shared';
import { loadConfig } from '../config/env.js';
import { openDb } from './client.js';
import { runMigrations } from './migrate.js';
import { dbPorts, reconcileTopups } from './reconcile-topups.js';

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function main(): number {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean' },
      run: { type: 'boolean' },
      'older-than': { type: 'string', default: '30' },
    },
  });
  const dryRun = values['dry-run'] === true;
  const minutes = Number(values['older-than']);
  if (dryRun === (values.run === true) || !Number.isInteger(minutes) || minutes < 1) {
    out('usage: topups:reconcile -- --dry-run | --run [--older-than <minutes, 1 or more>]');
    return 2;
  }
  const config = loadConfig(process.env);
  const handle = openDb(config.databaseUrl);
  try {
    runMigrations(handle.db);
    const report = reconcileTopups(dbPorts(handle.db), {
      dryRun,
      olderThanMs: minutes * 60_000,
      nowMs: Date.now(),
    });
    const verb = dryRun ? 'would release' : 'released';
    out(
      `${dryRun ? 'dry run: ' : ''}checked ${report.checked}, ${verb} ${report.released.length}, ambiguous ${report.ambiguous.length}`,
    );
    for (const id of report.released) out(`${verb}: ${id}`);
    for (const a of report.ambiguous) {
      out(
        `ambiguous: hold ${a.holdId} user ${a.userId} amount ${formatOkrw(BigInt(a.amountAokrw))} order ${a.orderId} (${a.reason})`,
      );
    }
    return report.ambiguous.length === 0 ? 0 : 1;
  } finally {
    handle.close();
  }
}

process.exitCode = main();
