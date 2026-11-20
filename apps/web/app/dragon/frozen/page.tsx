// The dragon sleeps (design/screens/Frozen.dc.html). Assembly only (architecture.md).
import { EntryGate } from '../../../features/me/containers/EntryGate';
import { FrozenContainer } from '../../../features/wallet/containers/FrozenContainer';

export default function FrozenPage() {
  return (
    <EntryGate>
      <FrozenContainer />
    </EntryGate>
  );
}
