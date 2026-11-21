import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingShape } from './LoadingShape';

// Harness states from docs/wiki/components/ui/base/LoadingShape.md.
const meta = {
  title: 'base/LoadingShape',
  component: LoadingShape,
  decorators: [(Story) => <div style={{ width: 350 }}>{Story()}</div>],
} satisfies Meta<typeof LoadingShape>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChatHeader: Story = { args: { kind: 'chatHeader' } };
export const Meter: Story = { args: { kind: 'meter' } };
export const OrderStatus: Story = { args: { kind: 'orderStatus' } };
export const Rows: Story = { args: { kind: 'rows', count: 3 } };
export const Detail: Story = { args: { kind: 'detail' } };
