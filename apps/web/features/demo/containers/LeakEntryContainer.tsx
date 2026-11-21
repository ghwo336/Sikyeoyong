'use client';

import { ListRow } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { isDemoBuild } from '../demo-build';

/** The way into the key leak comparison (demo scene 5): one quiet row at the end of the wallet, demo builds only. */
export function LeakEntryContainer() {
  const router = useRouter();
  if (!isDemoBuild()) return null;
  return (
    <ListRow
      label="열쇠를 도둑맞았다면"
      trailing="chevron"
      onPress={() => {
        router.push('/demo/leak');
      }}
    />
  );
}
