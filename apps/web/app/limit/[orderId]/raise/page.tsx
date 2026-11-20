// Raise the level for this order (the LimitChat.dc.html card). Assembly only (architecture.md).
import { RaiseContainer } from '../../../../features/limits/containers/RaiseContainer';

export default async function RaisePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <RaiseContainer orderId={orderId} />;
}
