import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReceiptDetails } from './ReceiptDetails';

// Harness states from docs/wiki/components/ui/order/ReceiptDetails.md. Values from Receipt.dc.html.
const meta = {
  title: 'order/ReceiptDetails',
  component: ReceiptDetails,
  args: {
    txHash: '0x8f3a5b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7ec21e',
    agentId: '1042',
    rules: [
      'AGENT_OKRW_TRANSFER_LIMIT_POLICY',
      'PERIODIC_VOLUME_POLICY',
      '전역 KYC 한도',
      'EAS_POLICY (가게 등록 때)',
    ],
    explorerUrl: 'https://example.invalid/tx/0x8f3a',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReceiptDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 접힘 */
export const Closed: Story = {};

/** 펼침 (Receipt.dc.html) */
export const Open: Story = { args: { defaultOpen: true } };

/** 규칙 없음 (경로 C 등) */
export const NoRules: Story = { args: { defaultOpen: true, rules: [] } };
