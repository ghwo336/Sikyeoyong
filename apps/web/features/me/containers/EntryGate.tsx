'use client';

import { AppError } from '@sikyeoyong/shared';
import { Splash } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { shownSpecies } from '../../../lib/theme';
import { useAgentSetup } from '../../onboarding/hooks/useSignup';
import { entryRoute } from '../entry';
import { useIdentity, useMe } from '../hooks/useMe';
import { useSplashTiming } from '../hooks/useSplashTiming';

/**
 * The app's front door: shows its children only to an owner with a hatched dragon and
 * sends everyone else to the step they are at (features/me/entry.ts decides where).
 * splash: the first entry (Main) shows the Splash while a slow session check runs
 * (user-flow 0, useSplashTiming); other screens show nothing while they ask.
 */
export function EntryGate({
  children,
  splash = false,
}: {
  readonly children: ReactNode;
  readonly splash?: boolean;
}) {
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
  const timing = useSplashTiming(!splash || route !== undefined);
  const ready = route !== undefined && !timing.holding;
  useEffect(() => {
    if (ready && route) router.replace(route);
  }, [ready, route, router]);
  if (ready && route === null) return <>{children}</>;
  // Until the next screen is up the splash stays, so there is no blank frame in between.
  return splash && timing.visible ? (
    <Splash species={me.data?.dragonSpecies ?? shownSpecies()} onSkip={timing.skip} />
  ) : null;
}
