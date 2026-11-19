import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Switch } from './Switch';

// Harness states from docs/wiki/components/ui/base/Switch.md.
const meta: Meta<typeof Switch> = {
  title: 'base/Switch',
  component: Switch,
  args: { labelId: 'stop', onChange: () => undefined },
};

export default meta;
type Story = StoryObj<typeof Switch>;

function Row({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: 342 }}>
      <span id="stop" style={{ flexGrow: 1 }}>
        용이 멈추기
      </span>
      <Switch checked={on} onChange={setOn} labelId="stop" />
    </div>
  );
}

/** 꺼짐 */
export const Off: Story = { render: () => <Row initial={false} /> };

/** 켜짐 */
export const On: Story = { render: () => <Row initial /> };

/** 누르는 중: 손잡이가 살짝 늘어난다 (마우스를 누른 채로 본다) */
export const Pressing: Story = {
  render: () => <Row initial={false} />,
  play: ({ canvasElement }) => {
    canvasElement
      .querySelector('[role="switch"]')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true }));
  },
};
