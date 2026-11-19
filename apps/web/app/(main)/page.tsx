// Main chat screen (design/screens/Main.dc.html). Assembly only (architecture.md).
import { BudgetMeterContainer } from '../../features/budget/containers/BudgetMeterContainer';
import { ChatContainer } from '../../features/chat/containers/ChatContainer';

export default function MainPage() {
  return (
    <>
      <BudgetMeterContainer />
      <ChatContainer />
    </>
  );
}
