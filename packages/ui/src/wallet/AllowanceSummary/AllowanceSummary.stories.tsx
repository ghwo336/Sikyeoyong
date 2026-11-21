import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { AllowanceSummary } from './AllowanceSummary';

// Harness states from docs/wiki/components/ui/wallet/AllowanceSummary.md. Values from Wallet.dc.html.
const meta = {
  title: 'wallet/AllowanceSummary',
  component: AllowanceSummary,
  args: {
    owner: okrwToAokrw(81_000n),
    pocket: okrwToAokrw(20_000n),
    onTopUp: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AllowanceSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (Wallet.dc.html) */
export const Default: Story = {};
/** 용돈 0 */
export const Empty: Story = { args: { owner: 0n, pocket: 0n } };
/** 로딩 */
export const Loading: Story = { args: { loading: true } };
/** 못 불러옴 */
export const Failed: Story = { args: { onRetry: () => undefined } };
