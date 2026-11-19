import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { useState } from 'react';
import { OrderConfirmSheet, type OrderConfirmSheetProps } from './OrderConfirmSheet';

// Harness states from docs/wiki/components/ui/order/OrderConfirmSheet.md. Values from Confirm.dc.html.
const won = (n: bigint) => okrwToAokrw(n);

const base: OrderConfirmSheetProps = {
  open: true,
  line: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
  species: 'forest',
  route: '마루국밥 본점에서 회사(역삼동)로, 25분쯤',
  items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
  request: '깍두기 많이',
  total: won(9_000n),
  perOrder: { used: won(9_000n), max: won(10_000n) },
  period: { used: won(219_000n), max: won(500_000n) },
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

const meta = {
  title: 'order/OrderConfirmSheet',
  component: OrderConfirmSheet,
  parameters: { layout: 'fullscreen' },
  args: base,
  decorators: [
    (Story) => (
      <div style={{ width: 390, height: 844, background: 'var(--color-ground)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderConfirmSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (Confirm.dc.html) */
export const Default: Story = {};

/** 한도 거의 참 */
export const NearLimit: Story = {
  args: {
    perOrder: { used: won(9_800n), max: won(10_000n), tone: 'warn' },
    period: { used: won(480_000n), max: won(500_000n), tone: 'warn' },
    items: [{ name: '보쌈 정식', quantity: 1, price: won(9_800n) }],
    total: won(9_800n),
  },
};

function Paying() {
  const [confirming, setConfirming] = useState(false);
  return (
    <OrderConfirmSheet
      {...base}
      confirming={confirming}
      onConfirm={() => {
        setConfirming(true);
      }}
    />
  );
}

/** 결제 중: 버튼이 돌고 눌리지 않는다 */
export const Confirming: Story = { args: { confirming: true } };

/** 결제 중 (눌러 보기): 누르면 결제 중으로 바뀐다 */
export const ConfirmingLive: Story = { render: () => <Paying /> };

/** 가격 변경 다시 확인 (D-19 SERVER_PRICE_CHANGED) */
export const PriceChanged: Story = {
  args: { priceChangedFrom: won(8_500n) },
};
