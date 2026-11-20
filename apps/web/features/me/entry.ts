import type { AppErrorCode } from '@sikyeoyong/shared';
import type { AgentSetupView } from '../../lib/api';

export type EntryRoute = '/start' | '/name' | '/hatch' | null;

/**
 * Where someone opening the app belongs (user-flow 1 to 4): not signed in goes to Start,
 * signed in without a dragon to Name, a dragon still hatching (or failed) to Hatch, and
 * a hatched dragon stays (null). undefined means still loading.
 */
export function entryRoute(input: {
  readonly meError?: AppErrorCode;
  readonly hasMe: boolean;
  readonly setupStatus?: AgentSetupView['status'];
}): EntryRoute | undefined {
  if (input.meError === 'UNAUTHENTICATED') return '/start';
  if (input.meError === 'NOT_FOUND') return '/name';
  if (!input.hasMe) return undefined;
  if (input.setupStatus === undefined) return undefined;
  return input.setupStatus === 'ACTIVE' ? null : '/hatch';
}
