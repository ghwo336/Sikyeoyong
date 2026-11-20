import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActiveOrderCard } from './ActiveOrderCard';

// Harness states from docs/wiki/components/ui/order/ActiveOrderCard.md. Values from Main.dc.html.
const STEPS = ['주문 접수', '조리 중', '배달 중', '도착'];

const meta = {
  title: 'order/ActiveOrderCard',
  component: ActiveOrderCard,
  args: {
    menu: '돼지국밥',
    status: '배달 중',
    eta: '8분 남았어요',
    steps: STEPS,
    current: 3,
    onPress: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActiveOrderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 주문 접수 */
export const Accepted: Story = { args: { status: '주문 접수', eta: '가게가 확인 중', current: 1 } };
/** 조리 중 */
export const Cooking: Story = { args: { status: '조리 중', eta: '곧 출발해요', current: 2 } };
/** 배달 중 (Main.dc.html 기본) */
export const Delivering: Story = {};
/** 긴 메뉴 이름은 말줄임 */
export const LongMenu: Story = { args: { menu: '얼큰 순대국밥 특 사이즈 외 2개' } };
