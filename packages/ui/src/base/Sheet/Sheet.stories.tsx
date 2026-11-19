import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../Button';
import { Sheet } from './Sheet';

// Harness states from docs/wiki/components/ui/base/Sheet.md. Frame from Confirm.dc.html.
const meta = {
  title: 'base/Sheet',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

function Harness({ initial, long = false }: { initial: boolean; long?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div style={{ height: 844, background: 'var(--color-ground)', padding: 20 }}>
      <Button
        variant="primary"
        onPress={() => {
          setOpen(true);
        }}
      >
        시트 열기
      </Button>
      <Sheet
        open={open}
        label="주문 확인"
        onClose={() => {
          setOpen(false);
        }}
      >
        {(long ? Array.from({ length: 30 }, (_, i) => i) : [0, 1]).map((i) => (
          <p key={i} style={{ margin: 0 }}>
            돼지국밥 {String(i + 1)}
          </p>
        ))}
        <Button
          variant="primary"
          onPress={() => {
            setOpen(false);
          }}
        >
          닫기
        </Button>
      </Sheet>
    </div>
  );
}

/** 열림 */
export const Open: Story = {
  args: { open: true, label: '주문 확인', onClose: noop, children: null },
  render: () => <Harness initial />,
};

/** 닫히는 중(스프링): 열린 뒤 닫기를 눌러 내려가는 모습을 본다 */
export const Closing: Story = {
  args: { open: true, label: '주문 확인', onClose: noop, children: null },
  render: () => <Harness initial />,
  play: async ({ canvasElement }) => {
    await new Promise((r) => setTimeout(r, 600));
    const close = Array.from(canvasElement.ownerDocument.querySelectorAll('button')).find(
      (b) => b.textContent === '닫기',
    );
    close?.click();
  },
};

/** 내용 길 때 스크롤 */
export const LongContent: Story = {
  args: { open: true, label: '주문 확인', onClose: noop, children: null },
  render: () => <Harness initial long />,
};
