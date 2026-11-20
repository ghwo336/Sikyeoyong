// Over the per-order limit (design/screens/Blocked.dc.html). Assembly only (architecture.md).
import { BlockedContainer } from '../../../features/limits/containers/BlockedContainer';

export default async function BlockedPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <BlockedContainer orderId={orderId} />;
}
