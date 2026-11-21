/**
 * pnpm agent-keys:rotate -- --dry-run | --run
 *
 * Owner-run (security.md). Re-seals every agent_keys row as v2 under AGENT_KEY_ENCRYPTION_KEY,
 * opening old rows with that key or with AGENT_KEY_ENCRYPTION_KEY_PREVIOUS. Back up the database
 * first and stop the API while it runs. Keys come from the environment (node --env-file), and
 * nothing secret is printed: only counts and the addresses of rows that failed.
 */
import { parseArgs } from 'node:util';
import { loadConfig } from '../../config/env.js';
import { openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { rotateAgentKeys } from './agent-key-rotation.js';
import { AgentKeyVault, parseMasterKeys } from './agent-key-vault.js';
import { AgentKeysRepository } from './agent-keys.repository.js';

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function main(): number {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' }, run: { type: 'boolean' } },
  });
  const dryRun = values['dry-run'] === true;
  if (dryRun === (values.run === true)) {
    out('usage: agent-keys:rotate -- --dry-run | --run');
    return 2;
  }
  const config = loadConfig(process.env);
  const keys = parseMasterKeys(
    config.secrets.agentKeyEncryptionKey,
    config.secrets.agentKeyEncryptionKeyPrevious,
  );
  const handle = openDb(config.databaseUrl);
  try {
    runMigrations(handle.db);
    const store = new AgentKeysRepository(handle);
    const vault = new AgentKeyVault(keys.current, store, Date.now, keys.previous);
    const report = rotateAgentKeys(vault, store, { dryRun });
    out(
      `${dryRun ? 'dry run: ' : ''}rotated ${report.rotated}, unchanged ${report.unchanged}, failed ${report.failed.length}`,
    );
    for (const address of report.failed) out(`failed: ${address}`);
    return report.failed.length === 0 ? 0 : 1;
  } finally {
    handle.close();
    keys.current.fill(0);
    keys.previous?.fill(0);
  }
}

process.exitCode = main();
