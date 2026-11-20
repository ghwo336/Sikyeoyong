// Wallet (design/screens/Wallet.dc.html). Assembly only (architecture.md).
import { EntryGate } from '../../features/me/containers/EntryGate';
import { WalletTopBar } from '../../features/wallet/containers/WalletTopBar';
import { AllowanceContainer } from '../../features/wallet/containers/AllowanceContainer';
import { CustodyNoteContainer } from '../../features/wallet/containers/CustodyNoteContainer';
import { DragonControlsContainer } from '../../features/wallet/containers/DragonControlsContainer';
import { LimitRowsContainer } from '../../features/wallet/containers/LimitRowsContainer';

export default function WalletPage() {
  return (
    <EntryGate>
      <WalletTopBar />
      <AllowanceContainer />
      <LimitRowsContainer />
      <DragonControlsContainer />
      <CustodyNoteContainer />
    </EntryGate>
  );
}
