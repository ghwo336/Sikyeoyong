import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { OrderLines } from './OrderLines';

// Harness states from docs/wiki/components/ui/order/OrderLines.md.
const meta = {
  title: 'order/OrderLines',
  component: OrderLines,
  decorators: [
    (Story) => (
      <div style={{ width: 318, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderLines>;

export default meta;
type Story = StoryObj<typeof meta>;

const won = (n: bigint) => okrwToAokrw(n);

/** 영수증 크기 (body, Done과 Receipt) */
export const Body: Story = {
  args: {
    size: 'body',
    items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
    request: '깍두기 많이, 문 앞에 두고 가 주세요',
  },
};

/** 확인 시트 크기 (row, Confirm) */
export const Row: Story = {
  args: {
    size: 'row',
    items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
    request: '깍두기 많이',
  },
};

/** 여러 줄, 요청 없음 */
export const ManyNoRequest: Story = {
  args: {
    size: 'body',
    items: [
      { name: '돼지국밥', quantity: 1, price: won(9_000n) },
      { name: '김밥', quantity: 2, price: won(7_000n) },
      { name: '순대 추가', quantity: 1, price: won(3_000n) },
    ],
  },
};
