// Main chat screen (design/screens/Main.dc.html). Assembly only (architecture.md).
import { BudgetMeterContainer } from '../../features/budget/containers/BudgetMeterContainer';
import { ChatContainer } from '../../features/chat/containers/ChatContainer';
import { DragonHeaderContainer } from '../../features/me/containers/DragonHeaderContainer';
import { EntryGate } from '../../features/me/containers/EntryGate';

export default function MainPage() {
  return (
    <EntryGate>
      <ChatContainer header={<DragonHeaderContainer />} top={<BudgetMeterContainer />} />
    </EntryGate>
  );
}
