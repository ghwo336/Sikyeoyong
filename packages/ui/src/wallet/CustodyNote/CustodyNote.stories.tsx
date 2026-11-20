import type { Meta, StoryObj } from '@storybook/react-vite';
import { CustodyNote } from './CustodyNote';

// Harness states from docs/wiki/components/ui/wallet/CustodyNote.md. Words from decisions D-24.
const meta = {
  title: 'wallet/CustodyNote',
  component: CustodyNote,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CustodyNote>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (지갑 화면 맨 아래) */
export const Default: Story = {};
/** 자세히 보기 켬 */
export const Detailed: Story = { args: { detailed: true } };
