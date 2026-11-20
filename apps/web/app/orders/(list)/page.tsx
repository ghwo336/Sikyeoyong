// 주문 내역 (Main.dc.html receipt button; no design screen yet, web.md). Assembly only.
import { EntryGate } from '../../../features/me/containers/EntryGate';
import { OrderHistoryContainer } from '../../../features/orders/containers/OrderHistoryContainer';

export default function OrderHistoryPage() {
  return (
    <EntryGate>
      <OrderHistoryContainer />
    </EntryGate>
  );
}
