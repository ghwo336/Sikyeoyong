import { AppError, type AppErrorCode } from '@sikyeoyong/shared';
import type { AgentSetupView } from '../../lib/api';

export type EntryRoute = '/start' | '/verify' | '/name' | '/hatch' | null;

/**
 * Where someone opening the app belongs (user-flow 1 to 4): not signed in goes to Start,
 * signed in without a dragon to Verify (identity check not passed) or Name, a dragon still
 * hatching (or failed) to Hatch, and a hatched dragon stays (null). undefined means still
 * loading. The Pouchi vault is the same for sign-up and sign-in (D-29), so every login comes
 * through here and this decides the step.
 */
export function entryRoute(input: {
  readonly meError?: AppErrorCode;
  readonly hasMe: boolean;
  readonly setupStatus?: AgentSetupView['status'];
  /** GET /identity, asked only when there is no dragon. */
  readonly verified?: boolean;
}): EntryRoute | undefined {
  if (input.meError === 'UNAUTHENTICATED') return '/start';
  if (input.meError === 'NOT_FOUND') {
    if (input.verified === undefined) return undefined;
    return input.verified ? '/name' : '/verify';
  }
  // Any other failure (5xx, offline): stay and let the screen show its own error, never a blank page.
  if (input.meError !== undefined) return null;
  if (!input.hasMe) return undefined;
  if (input.setupStatus === undefined) return undefined;
  return input.setupStatus === 'ACTIVE' ? null : '/hatch';
}

/**
 * GET /me retries: a 401 or a 404 is an answer (where to go), so it is not asked again;
 * anything else (5xx, offline) is retried up to three times like other queries.
 */
export function retryMe(failureCount: number, error: unknown): boolean {
  if (
    error instanceof AppError &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'NOT_FOUND')
  ) {
    return false;
  }
  return failureCount < 3;
}
