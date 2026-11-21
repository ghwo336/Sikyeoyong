import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionDivider } from './SessionDivider';

// Harness states from docs/wiki/components/ui/chat/SessionDivider.md.
const meta = {
  title: 'chat/SessionDivider',
  component: SessionDivider,
  args: { label: '11월 21일 저녁' },
} satisfies Meta<typeof SessionDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 날짜와 끼니 */
export const Default: Story = {};

/** 시각을 모르는 옛 대화 */
export const Unknown: Story = { args: { label: '지난 대화' } };
