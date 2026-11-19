import type { Meta, StoryObj } from '@storybook/react-vite';
import { OrderStatusHeader } from './OrderStatusHeader';

// Harness states from docs/wiki/components/ui/order/OrderStatusHeader.md.
const meta = {
  title: 'order/OrderStatusHeader',
  component: OrderStatusHeader,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OrderStatusHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

// 2026-12-09 12:55 KST
const ETA = Date.UTC(2026, 11, 9, 3, 55);

/** 조리 중 (Done.dc.html) */
export const Cooking: Story = {
  args: { etaAt: ETA, remainingMin: 25, variant: 'eta-first' },
};

/** 배달 중 (Tracking.dc.html) */
export const Delivering: Story = {
  args: { etaAt: ETA, remainingMin: 8, variant: 'remaining-first', distance: '1.2km' },
};

/** 지연 갱신: 도착 시각이 늦춰지고 남은 시간이 다시 늘어난다 */
export const Delayed: Story = {
  args: {
    etaAt: ETA + 10 * 60_000,
    remainingMin: 18,
    variant: 'remaining-first',
    distance: '2.4km',
  },
};
