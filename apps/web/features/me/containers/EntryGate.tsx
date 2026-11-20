'use client';

import { AppError } from '@sikyeoyong/shared';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAgentSetup } from '../../onboarding/hooks/useSignup';
import { entryRoute } from '../entry';
import { useIdentity, useMe } from '../hooks/useMe';

/**
 * The app's front door: shows its children only to an owner with a hatched dragon and
 * sends everyone else to the step they are at (features/me/entry.ts decides where).
 */
export function EntryGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useMe();
  const setup = useAgentSetup(me.data !== undefined);
  const noDragon = me.error instanceof AppError && me.error.code === 'NOT_FOUND';
  const identity = useIdentity(noDragon);
  const route = entryRoute({
    ...(me.error instanceof AppError ? { meError: me.error.code } : {}),
    hasMe: me.data !== undefined,
    ...(setup.data === undefined ? {} : { setupStatus: setup.data.status }),
    // If the answer cannot be had, Verify is the safe step (passing it again changes nothing).
    ...(identity.data !== undefined
      ? { verified: identity.data.verified }
      : identity.isError
        ? { verified: false }
        : {}),
  });
  useEffect(() => {
    if (route) router.replace(route);
  }, [route, router]);
  return route === null ? <>{children}</> : null;
}
