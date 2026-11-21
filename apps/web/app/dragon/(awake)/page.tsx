// Wallet (design/screens/Wallet.dc.html). Assembly only (architecture.md).
import { LeakEntryContainer } from '../../../features/demo/containers/LeakEntryContainer';
import { EntryGate } from '../../../features/me/containers/EntryGate';
import { FrozenRedirect } from '../../../features/wallet/containers/FrozenRedirect';
import { WalletTopBar } from '../../../features/wallet/containers/WalletTopBar';
import { AllowanceContainer } from '../../../features/wallet/containers/AllowanceContainer';
import { CustodyNoteContainer } from '../../../features/wallet/containers/CustodyNoteContainer';
import { DragonControlsContainer } from '../../../features/wallet/containers/DragonControlsContainer';
import { LimitRowsContainer } from '../../../features/wallet/containers/LimitRowsContainer';

export default function WalletPage() {
  return (
    <EntryGate>
      <FrozenRedirect />
      <WalletTopBar />
      <AllowanceContainer />
      <LimitRowsContainer />
      <DragonControlsContainer />
      <CustodyNoteContainer />
      <LeakEntryContainer />
    </EntryGate>
  );
}
