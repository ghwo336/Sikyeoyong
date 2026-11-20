'use client';

import { CustodyNote } from '@sikyeoyong/ui';
import { useMe } from '../../me/hooks/useMe';
import { useDetailsMode } from '../hooks/useDetailsMode';

/** D-24: the trial line under the wallet, only while the operator holds the owner rights. */
export function CustodyNoteContainer() {
  const me = useMe().data;
  const [details] = useDetailsMode();
  if (!me?.custodial) return null;
  return <CustodyNote detailed={details} />;
}
