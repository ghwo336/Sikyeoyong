import type { Meta, StoryObj } from '@storybook/react-vite';
import { PastLine } from './PastLine';

// Harness states from docs/wiki/components/ui/chat/PastLine.md.
const meta = {
  title: 'chat/PastLine',
  component: PastLine,
  args: { text: '돼지국밥 9,000원, 도착함' },
} satisfies Meta<typeof PastLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 도착한 주문 */
export const Arrived: Story = {};

/** 고르지 않은 추천 */
export const Unpicked: Story = { args: { text: '돼지국밥 9,000원 외 2곳, 고르지 않음' } };

/** 아주 긴 글은 한 줄에서 줄임표 */
export const Long: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 240, display: 'flex', flexDirection: 'column' }}>
        <Story />
      </div>
    ),
  ],
  args: { text: '마루국밥 본점 특 돼지국밥 곱빼기 9,000원, 도착함' },
};
