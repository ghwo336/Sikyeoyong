import testnetDemo from './deployments/450815.demo.json' with { type: 'json' };
import { parseDeployment, type DeploymentRecord } from './deployments.js';

/**
 * Records the deploy CLI has written (deployments/<chainId>.<profile>.json). Add one import line
 * per file when the CLI creates it.
 */
const RAW: readonly unknown[] = [testnetDemo];

export const DEPLOYMENTS: readonly DeploymentRecord[] = RAW.map(parseDeployment);
