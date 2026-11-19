import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { FrozenPanel } from './FrozenPanel';

// Harness states from docs/wiki/components/ui/wallet/FrozenPanel.md. Values from Frozen.dc.html.
const meta = {
  title: 'wallet/FrozenPanel',
  component: FrozenPanel,
  parameters: { layout: 'fullscreen' },
  args: {
    pocket: okrwToAokrw(20_000n),
    species: 'forest',
    onRefund: () => undefined,
    onWake: () => undefined,
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 350,
          height: 700,
          padding: 20,
          display: 'flex',
          background: 'var(--color-sleep-ground)',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FrozenPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 기본 (Frozen.dc.html) */
export const Default: Story = {};
/** 주머니 0: 돌려받기 없음 */
export const EmptyPocket: Story = { args: { pocket: 0n } };
/** 돌려받는 중 */
export const Refunding: Story = { args: { refunding: true } };
