import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

// Harness states from docs/wiki/components/ui/base/Skeleton.md.
const meta = {
  title: 'base/Skeleton',
  component: Skeleton,
  decorators: [(Story) => <div style={{ width: 342, fontSize: 14 }}>{Story()}</div>],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 지갑 금액 자리 (28px, 10em) */
export const WalletAmount: Story = { args: { height: 'walletAmount', width: '10em' } };

/** 작은 글 자리 (13px, 7.5em) */
export const Caption: Story = { args: { height: 'caption', width: '7.5em' } };

/** 카드 자리 (120px 높이) */
export const Block: Story = { args: { height: 'block', blockHeight: '120px', width: '100%' } };

/** 둥근 자리 (44px) */
export const Circle: Story = { args: { height: 'circle', width: '44px' } };

/** 추천 줄 자리 (12px, 40%와 65%) */
export const MetaRows: Story = {
  args: { height: 'meta', width: '40%' },
  render: () => (
    <div style={{ display: 'grid', gap: 8 }}>
      <Skeleton height="meta" width="40%" />
      <Skeleton height="meta" width="65%" />
    </div>
  ),
};
