import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { OrderSummary } from './OrderSummary';

// Harness states from docs/wiki/components/ui/order/OrderSummary.md.
const meta = {
  title: 'order/OrderSummary',
  component: OrderSummary,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

const won = (n: bigint) => okrwToAokrw(n);

/** 메뉴 하나 (Done.dc.html) */
export const OneItem: Story = {
  args: {
    store: '마루국밥 본점에서 회사(역삼동)로',
    items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
    request: '깍두기 많이, 문 앞에 두고 가 주세요',
    total: won(9_000n),
  },
};

/** 메뉴 여럿 */
export const ManyItems: Story = {
  args: {
    store: '대청분식에서 회사(역삼동)로',
    items: [
      { name: '어묵탕', quantity: 1, price: won(5_000n) },
      { name: '김밥', quantity: 2, price: won(7_000n) },
    ],
    request: '단무지 빼 주세요',
    total: won(12_000n),
  },
};

/** 요청 없음 */
export const NoRequest: Story = {
  args: {
    store: '마루국밥 본점에서 회사(역삼동)로',
    items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
    total: won(9_000n),
  },
};

/** Receipt.dc.html: 시각과 아래 세 줄 */
export const Receipt: Story = {
  args: {
    store: '마루국밥 본점',
    when: '12월 9일 12시 31분',
    items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
    total: won(9_000n),
    details: [
      { label: '결제 수단', value: '용이 용돈' },
      { label: '한 번에 쓸 수 있는 돈', value: '9,000 / 10,000원' },
      { label: '30일 한도', value: '219,000 / 500,000원' },
    ],
  },
};
