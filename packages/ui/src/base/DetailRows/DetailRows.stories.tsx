import type { Meta, StoryObj } from '@storybook/react-vite';
import { DetailRows } from './DetailRows';

// Harness states from docs/wiki/components/ui/base/DetailRows.md.
const meta = {
  title: 'base/DetailRows',
  component: DetailRows,
  decorators: [
    (Story) => (
      <div style={{ width: 318 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DetailRows>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 영수증 카드 줄 (inline small tight, 값도 옅게) */
export const ReceiptCard: Story = {
  args: {
    size: 'small',
    gap: 'tight',
    tone: 'secondary',
    rows: [
      { label: '결제 수단', value: '용이 용돈' },
      { label: '한 번에 쓸 수 있는 돈', value: '9,000 / 10,000원' },
      { label: '30일 한도', value: '219,000 / 500,000원' },
    ],
  },
};

/** 자세히 보기 안 (inline caption normal) */
export const ReceiptDetails: Story = {
  args: {
    size: 'caption',
    gap: 'normal',
    rows: [
      { label: '결제 기록 번호', value: <span title="0x8f3a00c21e">0x8f3a…c21e</span> },
      { label: '용이 신분증 번호', value: '#1042' },
    ],
  },
};

/** 한도 바꾸기 카드 (inline small loose) */
export const LimitChange: Story = {
  args: {
    size: 'small',
    gap: 'loose',
    rows: [
      { label: '레벨', value: '1에서 3으로' },
      { label: '30일 한도', value: '500,000원 그대로' },
    ],
  },
};

/** 신분증 (stacked caption loose) */
export const IdCardFacts: Story = {
  args: {
    layout: 'stacked',
    size: 'caption',
    gap: 'loose',
    rows: [
      { label: '레벨', value: '1' },
      { label: '한 번에', value: '10,000원까지' },
      { label: '주인', value: '실명 확인됨' },
      { label: '태어난 날', value: '2026. 12. 1.' },
    ],
  },
};
