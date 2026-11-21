import type { Meta, StoryObj } from '@storybook/react-vite';
import { useKeyboardInset } from './useKeyboardInset';

// Harness states from docs/wiki/components/ui/base/useKeyboardInset.md. The hook has no look,
// so the demo prints the number. Open the field on a phone (or the device toolbar) to see it.
function InsetDemo() {
  const inset = useKeyboardInset();
  return (
    <div style={{ display: 'grid', gap: 12, width: 342 }}>
      <input placeholder="눌러 보세요" style={{ height: 48 }} />
      <span>키보드가 가린 높이 {String(inset)}px</span>
    </div>
  );
}

const meta = { title: 'base/useKeyboardInset', component: InsetDemo } satisfies Meta<
  typeof InsetDemo
>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 키보드를 닫았을 때 0, 열면 가린 높이 */
export const Demo: Story = {};
