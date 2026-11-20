'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { OrderSummary, ReceiptDetails, TopBar } from '@sikyeoyong/ui';
import { amountRatioText } from '../../../lib/format';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useDetailsMode } from '../../wallet/hooks/useDetailsMode';
import { useOrder } from '../hooks/useOrder';
import { orderStep } from '../status';

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
  // A stopped or unpaid order has no receipt: it must never look paid (status.ts).
  if (orderStep(order.status) === null) return <TopBar title="주문 상세" onBack={back} />;
  const amount = parseAokrw(order.amount);
  const rows = [{ label: '결제 수단', value: '용이 용돈' }];
  // The order keeps no limits from its time (orders has no such column), so these rows are
  // today's limits and say so ("지금"), never posing as the limit the order was paid under
  // (browser QA 2: 20,000 / 30,000원 when the limit was 20,000 then).
  if (budget) {
    rows.push(
      {
        label: '지금 한 번에 쓸 수 있는 돈',
        value: amountRatioText(amount, parseAokrw(budget.perOrderLimit)),
      },
      {
        label: '지금 30일 한도',
        value: amountRatioText(parseAokrw(budget.chainUsed), parseAokrw(budget.chainCap)),
      },
    );
  }
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
        details={rows}
      />
      {order.txHash !== undefined && order.receipt !== undefined && (
        <ReceiptDetails
          txHash={order.txHash}
          agentId={order.receipt.agentId}
          rules={order.receipt.rules.map((r) => r.label)}
          explorerUrl={order.receipt.explorerUrl}
          defaultOpen={details}
        />
      )}
    </>
  );
}
