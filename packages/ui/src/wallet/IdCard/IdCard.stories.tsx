import type { Meta, StoryObj } from '@storybook/react-vite';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { IdCard } from './IdCard';

// Harness states from docs/wiki/components/ui/wallet/IdCard.md. Values from IdCard.dc.html.
// 2026-12-01 09:00 KST
const BORN = Date.UTC(2026, 11, 1, 0, 0);

const meta = {
  title: 'wallet/IdCard',
  component: IdCard,
  args: {
    name: '용이',
    ownerName: '이호재',
    level: 1,
    perOrder: okrwToAokrw(10_000n),
    ownerVerified: true,
    bornAt: BORN,
    species: 'forest',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IdCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 레벨 1 (IdCard.dc.html) */
export const LevelOne: Story = {};
/** 레벨 3 날개 */
export const LevelThreeWings: Story = {
  args: { level: 3, perOrder: okrwToAokrw(50_000n), species: 'star' },
};
/** 주인 미인증 */
export const OwnerNotVerified: Story = { args: { ownerVerified: false, species: 'water' } };
