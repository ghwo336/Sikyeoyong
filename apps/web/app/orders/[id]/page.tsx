// Order status (design/screens/Done.dc.html). Assembly only (architecture.md).
import { OrderStatusContainer } from '../../../features/orders/containers/OrderStatusContainer';

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderStatusContainer orderId={id} />;
}
