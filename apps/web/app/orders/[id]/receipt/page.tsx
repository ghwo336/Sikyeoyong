// Order receipt (design/screens/Receipt.dc.html). Assembly only (architecture.md).
import { ReceiptContainer } from '../../../../features/orders/containers/ReceiptContainer';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptContainer orderId={id} />;
}
