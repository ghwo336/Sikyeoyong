import type { Meta, StoryObj } from '@storybook/react-vite';
import { UserBubble } from './UserBubble';

// Harness states from docs/wiki/components/ui/chat/UserBubble.md. Text from Main.dc.html.
const meta = {
  title: 'chat/UserBubble',
  component: UserBubble,
  decorators: [
    (Story) => (
      <div style={{ width: 350, display: 'flex', flexDirection: 'column' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

const text = '점심 시켜 줘. 따뜻한 걸로';

/** 보냄 */
export const Sent: Story = { args: { text } };

/** 보내는 중 */
export const Sending: Story = { args: { text, status: 'sending' } };

/** 실패와 다시 보내기 */
export const Failed: Story = { args: { text, status: 'failed', onRetry: () => undefined } };
