'use client';

import { AppError } from '@sikyeoyong/shared';
import { RetryLine, Splash } from '@sikyeoyong/ui';
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
  // GET /me gave up on a 5xx or offline (retries spent): the first entry ends on the Splash's
  // error line with a retry, never waking forever (browser QA 4). Other screens keep drawing
  // their own error.
  // GET /agents/me failing for a signed-in owner is the same: no blank page and no tight loop
  // (QA 6 H2). The step is unknown, so the gate says so and asks again on a press.
  const setupFailed = me.data !== undefined && setup.isError && setup.data === undefined;
  const refetchGate = () => {
    if (setupFailed) void setup.refetch();
    else void me.refetch();
  };
  const meFailed = splash && (setupFailed || (route === null && me.error !== null));
  const timing = useSplashTiming(!splash || route !== undefined);
  const ready = route !== undefined && !timing.holding;
  useEffect(() => {
    if (ready && route) router.replace(route);
  }, [ready, route, router]);
  if (meFailed) {
    // While a retry runs it is the plain waking splash again (no flash of the chat).
    return me.isFetching || setup.isFetching ? (
      <Splash species={shownSpecies()} />
    ) : (
      <Splash species={shownSpecies()} onRetry={refetchGate} />
    );
  }
  if (setupFailed) {
    return <RetryLine onRetry={refetchGate}>용이 소식을 못 불러왔어요</RetryLine>;
  }
  if (ready && route === null) return <>{children}</>;
  // Until the next screen is up the splash stays, so there is no blank frame in between.
  // A press can only skip once the next screen is known (the rest of SPLASH_MIN_MS); before
  // that there is nowhere to go, so the splash is not a button and says only that it waits
  // (browser QA 2: "시켜용 시작하기" did nothing while the session check ran).
  return splash && timing.visible ? (
    <Splash
      species={me.data?.dragonSpecies ?? shownSpecies()}
      {...(route !== undefined ? { onSkip: timing.skip } : {})}
    />
  ) : null;
}
