import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuickReplies } from './QuickReplies';

// Harness states from docs/wiki/components/ui/chat/QuickReplies.md.
const meta = {
  title: 'chat/QuickReplies',
  component: QuickReplies,
  args: { onPick: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuickReplies>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 두 개 (Main.dc.html) */
export const Two: Story = {
  args: {
    items: [
      { id: 'pick', label: '돼지국밥으로' },
      { id: 'cheaper', label: '더 싼 거 없어?' },
    ],
  },
};

/** 넘칠 때 줄바꿈 */
export const Wrapping: Story = {
  args: {
    items: [
      { id: 'pick', label: '돼지국밥으로' },
      { id: 'cheaper', label: '더 싼 거 없어?' },
      { id: 'other', label: '다른 가게도 보여 줘' },
      { id: 'later', label: '조금 있다가' },
      { id: 'cancel', label: '오늘은 그만' },
    ],
  },
};
