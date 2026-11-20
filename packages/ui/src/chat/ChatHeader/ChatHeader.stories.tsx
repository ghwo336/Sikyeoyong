import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatHeader } from './ChatHeader';

// Harness states from docs/wiki/components/ui/chat/ChatHeader.md.
const meta = {
  title: 'chat/ChatHeader',
  component: ChatHeader,
  args: { name: '용이', caption: '한 번에 10,000원까지', species: 'forest' },
  decorators: [(Story) => <div style={{ width: 350 }}>{Story()}</div>],
} satisfies Meta<typeof ChatHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 주문 내역과 설정 버튼 (Main 시안, 2026-11-20) */
export const WithSettings: Story = {
  args: { onHistory: () => undefined, onSettings: () => undefined },
};

/** 설정 버튼만 */
export const SettingsOnly: Story = {
  args: { onSettings: () => undefined },
};

/** 설정 버튼 없음 (LimitChat 시안) */
export const NoSettings: Story = {};

/** 다른 종, 긴 이름과 큰 한도 (줄바꿈) */
export const LongCaption: Story = {
  args: {
    name: '봄봄이와친구들',
    caption: '한 번에 50,000원까지, 30일에 500,000원까지',
    species: 'flower',
    onSettings: () => undefined,
  },
  decorators: [(Story) => <div style={{ width: 240 }}>{Story()}</div>],
};
