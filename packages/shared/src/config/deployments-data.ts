import { parseDeployment, type DeploymentRecord } from './deployments.js';

/**
 * Records the deploy CLI has written (deployments/<chainId>.<profile>.json). Add one import line
 * per file when the CLI creates it. Empty until the first real deployment.
 */
const RAW: readonly unknown[] = [];

export const DEPLOYMENTS: readonly DeploymentRecord[] = RAW.map(parseDeployment);
