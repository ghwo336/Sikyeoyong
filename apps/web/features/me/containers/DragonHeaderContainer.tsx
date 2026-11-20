'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { ChatHeader } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useMe } from '../hooks/useMe';
import { limitLine } from '../limit-line';

/** Main.dc.html top row: the dragon, its name and per-order limit, order history, settings. */
export function DragonHeaderContainer() {
  const router = useRouter();
  const me = useMe().data;
  if (!me) return null;
  return (
    <ChatHeader
      name={me.dragonName}
      caption={limitLine(parseAokrw(me.perOrderLimit))}
      species={me.dragonSpecies}
      onHistory={() => {
        router.push('/orders');
      }}
      onSettings={() => {
        // Wallet.dc.html (용이 용돈).
        router.push('/dragon');
      }}
    />
  );
}
