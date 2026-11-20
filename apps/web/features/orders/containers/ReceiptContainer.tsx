'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { AmountRatio, ListRow, OrderSummary, ReceiptDetails, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useDetailsMode } from '../../wallet/hooks/useDetailsMode';
import { useOrder } from '../hooks/useOrder';

/**
 * Receipt.dc.html: the order lines, how it was paid, the limits it fit, and 자세히 보기
 * (the payment record, the ID number, the rules the chain checked, the explorer link).
 * Chain words appear only inside 자세히 보기 (D-17); it starts open when the device's
 * 자세히 보기 setting is on.
 */
export function ReceiptContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const { data: order } = useOrder(orderId);
  const budget = useBudget().data;
  const [details] = useDetailsMode();
  const back = () => {
    router.push(`/orders/${encodeURIComponent(orderId)}`);
  };
  if (!order) return <TopBar title="주문 상세" onBack={back} />;
  const amount = parseAokrw(order.amount);
  return (
    <>
      <TopBar title="주문 상세" onBack={back} />
      <OrderSummary
        store={order.store}
        items={order.items.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          price: parseAokrw(l.price),
        }))}
        request={order.request}
        total={amount}
        details={[{ label: '결제 수단', value: '용이 용돈' }]}
      />
      {budget && (
        <>
          <ListRow
            label="한 번에 쓸 수 있는 돈"
            value={
              <AmountRatio
                value={amount}
                max={parseAokrw(budget.perOrderLimit)}
                size="meter"
                valueUnit={false}
              />
            }
          />
          <ListRow
            label="30일 한도"
            value={
              <AmountRatio
                value={parseAokrw(budget.chainUsed)}
                max={parseAokrw(budget.chainCap)}
                size="meter"
                valueUnit={false}
              />
            }
          />
        </>
      )}
      {order.txHash !== undefined && order.receipt !== undefined && (
        <ReceiptDetails
          txHash={order.txHash}
          agentId={order.receipt.agentId}
          rules={order.receipt.rules}
          explorerUrl={order.receipt.explorerUrl}
          defaultOpen={details}
        />
      )}
    </>
  );
}
