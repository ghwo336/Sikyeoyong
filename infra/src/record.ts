import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDeployment, type DeploymentRecord, type PolicyProfile } from '@sikyeoyong/shared';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, '..', '..');
export const DEPLOYMENTS_DIR = join(
  REPO_ROOT,
  'packages',
  'shared',
  'src',
  'config',
  'deployments',
);

export function recordPath(chainId: number, profile: PolicyProfile): string {
  return join(DEPLOYMENTS_DIR, `${chainId}.${profile}.json`);
}

export function recordExists(chainId: number, profile: PolicyProfile): boolean {
  return existsSync(recordPath(chainId, profile));
}

export function readRecord(chainId: number, profile: PolicyProfile): DeploymentRecord {
  return parseDeployment(JSON.parse(readFileSync(recordPath(chainId, profile), 'utf8')));
}

/** Validates before writing, so a bad record never lands in the repo. */
export function writeRecord(record: DeploymentRecord): string {
  const checked = parseDeployment(record);
  const path = recordPath(checked.chainId, checked.profile);
  writeFileSync(path, `${JSON.stringify(checked, null, 2)}\n`, 'utf8');
  return path;
}
