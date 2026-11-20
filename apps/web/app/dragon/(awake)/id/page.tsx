// ID card (design/screens/IdCard.dc.html). Assembly only (architecture.md).
import { EntryGate } from '../../../../features/me/containers/EntryGate';
import { IdCardContainer } from '../../../../features/wallet/containers/IdCardContainer';

export default function IdCardPage() {
  return (
    <EntryGate>
      <IdCardContainer />
    </EntryGate>
  );
}
