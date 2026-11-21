// Key leak comparison (design/screens/LeakCompare.dc.html, demo scene 5). Assembly only (architecture.md).
// DEMO_MODE builds only: anything else is a 404.
import { notFound } from 'next/navigation';
import { LeakCompareContainer } from '../../../features/demo/containers/LeakCompareContainer';
import { isDemoBuild } from '../../../features/demo/demo-build';
import { EntryGate } from '../../../features/me/containers/EntryGate';

export default function LeakComparePage() {
  if (!isDemoBuild()) notFound();
  return (
    <EntryGate>
      <LeakCompareContainer />
    </EntryGate>
  );
}
