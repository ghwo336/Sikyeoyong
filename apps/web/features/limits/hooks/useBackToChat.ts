'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * A limit screen with nothing left to do (an old /limit/:id link: the order is gone, already
 * fits, or the limit is already raised) goes back to the chat instead of a blank screen.
 */
export function useBackToChat(when: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (when) router.replace('/');
  }, [when, router]);
}
