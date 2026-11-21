/**
 * pnpm demo:rehearse [-- --serve] [--out <dir>]
 *
 * Owner-run rehearsal of demo scenes 1 to 7 (design/user-flow.md): boots its own api and web,
 * drives a real Chrome through them, checks each scene's outcomes and prints a pass/fail table.
 * Exits 1 when a scene fails. Screenshots go to infra/rehearsal-out (gitignored).
 * --serve only starts the servers and waits (for looking around).
 */
import { join } from 'node:path';
import { exitCodeOf, formatTable } from '../src/rehearsal/checks.ts';
import { runScenes } from '../src/rehearsal/run.ts';
import { buildScenes } from '../src/rehearsal/scenes.ts';
import { REPO_ROOT, startServers } from '../src/rehearsal/servers.ts';

const log = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const outAt = argv.indexOf('--out');
  const outDir =
    outAt >= 0 && argv[outAt + 1]
      ? String(argv[outAt + 1])
      : join(REPO_ROOT, 'infra/rehearsal-out');
  const rehearsal = await startServers(log);
  try {
    if (argv.includes('--serve')) {
      log(`web ${rehearsal.webUrl}  api ${rehearsal.apiUrl}  logs ${rehearsal.workDir}`);
      await new Promise(() => undefined);
    }
    const outcomes = await runScenes(buildScenes(), rehearsal.webUrl, outDir, log);
    log('');
    log(formatTable(outcomes));
    log(`screenshots: ${outDir}  server logs: ${rehearsal.workDir}`);
    process.exitCode = exitCodeOf(outcomes);
  } finally {
    rehearsal.stop();
  }
}

main().catch((err: unknown) => {
  log(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
