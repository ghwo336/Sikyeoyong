import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { Meter } from './Meter';

// Harness states from docs/wiki/components/ui/base/Meter.md.
const meta = {
  title: 'base/Meter',
  component: Meter,
  decorators: [
    (Story) => (
      <div style={{ width: 322 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof meta>;

const BUDGET = okrwToAokrw(300_000n);
const base = { label: '이번 달 배달비', max: BUDGET } as const;

/** Main.dc.html: 흰 카드 안 (테두리 1px, 반경 16, 안쪽 12 14) */
export const Framed: Story = {
  args: { ...base, value: okrwToAokrw(210_000n), tone: 'warn', framed: true },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
};

/** 30%: normal */
export const Thirty: Story = {
  args: { ...base, value: okrwToAokrw(90_000n), tone: 'normal' },
};

/** 70% 노른자 (Main.dc.html) */
export const SeventyYolk: Story = {
  args: { ...base, value: okrwToAokrw(210_000n), tone: 'warn' },
};

/** 100% 호박색: over the limit still fills only to the end */
export const FullAmber: Story = {
  args: { ...base, value: okrwToAokrw(320_000n), tone: 'over' },
};

/** 0 */
export const Zero: Story = {
  args: { ...base, value: 0n, tone: 'normal' },
};

/** Arrived.dc.html: 14px, gap 12 */
export const ArrivedSize: Story = {
  args: { ...base, value: okrwToAokrw(219_000n), tone: 'warn', size: 'md' },
};

/** Confirm.dc.html: 한도 막대 (잎색, 진한 바탕, 간격 6) */
export const ConfirmLimit: Story = {
  args: {
    label: '한 번에',
    value: okrwToAokrw(9_000n),
    max: okrwToAokrw(10_000n),
    tone: 'normal',
    kind: 'limit',
  },
};
