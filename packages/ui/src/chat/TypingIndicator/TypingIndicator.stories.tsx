import type { Meta, StoryObj } from '@storybook/react-vite';
import { TypingIndicator } from './TypingIndicator';

// Harness states from docs/wiki/components/ui/chat/TypingIndicator.md.
const meta = {
  title: 'chat/TypingIndicator',
  component: TypingIndicator,
  args: { species: 'forest' },
} satisfies Meta<typeof TypingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (숲) */
export const Default: Story = {};

/** 물 */
export const Water: Story = { args: { species: 'water' } };
