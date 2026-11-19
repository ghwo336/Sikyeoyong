'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { ChatHeader } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useMe } from '../hooks/useMe';
import { levelLine } from '../level';

/** Main.dc.html top row: the dragon, its name, level and per-order limit, settings. */
export function DragonHeaderContainer() {
  const router = useRouter();
  const me = useMe().data;
  if (!me) return null;
  return (
    <ChatHeader
      name={me.dragonName}
      caption={levelLine(me.level, parseAokrw(me.perOrderLimit))}
      species={me.dragonSpecies}
      onSettings={() => {
        // Wallet.dc.html (용이 용돈). The page is not built yet (web.md).
        router.push('/dragon');
      }}
    />
  );
}
