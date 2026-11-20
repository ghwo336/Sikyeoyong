'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';

/** A sleeping dragon's wallet is the Frozen screen (design/README.md): go there. Draws nothing. */
export function FrozenRedirect() {
  const router = useRouter();
  const frozen = useBudget().data?.frozen === true;
  useEffect(() => {
    if (frozen) router.replace('/dragon/frozen');
  }, [frozen, router]);
  return null;
}
