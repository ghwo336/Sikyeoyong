// Look (design/screens/Look.dc.html, D-32). Assembly only (architecture.md).
import { EntryGate } from '../../../features/me/containers/EntryGate';
import { LookContainer } from '../../../features/wallet/containers/LookContainer';

export default function LookPage() {
  return (
    <EntryGate>
      <LookContainer />
    </EntryGate>
  );
}
