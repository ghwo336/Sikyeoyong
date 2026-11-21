// Limit edit from the wallet rows (no design of its own, web.md). Assembly only (architecture.md).
import { LimitEditContainer } from '../../../features/limits/containers/LimitEditContainer';
import { EntryGate } from '../../../features/me/containers/EntryGate';
import { FrozenRedirect } from '../../../features/wallet/containers/FrozenRedirect';

export default function LimitEditPage() {
  return (
    <EntryGate>
      <FrozenRedirect />
      <LimitEditContainer />
    </EntryGate>
  );
}
