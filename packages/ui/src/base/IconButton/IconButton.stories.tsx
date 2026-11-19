import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';

// Harness states from docs/wiki/components/ui/base/IconButton.md.
const meta = {
  title: 'base/IconButton',
  component: IconButton,
  args: { onPress: () => undefined },
  decorators: [(Story) => <div style={{ padding: 20 }}>{Story()}</div>],
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 뒤로, 왼쪽으로 10 당김 (TopBar, Name 시안) */
export const Back: Story = {
  args: { icon: 'back', label: '뒤로', edge: 'start' },
};

/** 설정 (ChatHeader, Main 시안) */
export const Settings: Story = {
  args: { icon: 'more', label: '용이 설정' },
};
