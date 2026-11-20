import type { Meta, StoryObj } from '@storybook/react-vite';
import { LookPreview } from './LookPreview';

// Harness states from docs/wiki/components/ui/wallet/LookPreview.md. Values from Look.dc.html.
// The tint follows the theme: pick 테마 in the toolbar, or see each species' story below.
const meta = {
  title: 'wallet/LookPreview',
  component: LookPreview,
  args: { name: '용이', species: 'forest' },
  decorators: [
    (Story, ctx) => (
      <div style={{ width: 350 }} data-species={ctx.args.species}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LookPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 숲용 (기본) */
export const Forest: Story = {};
/** 물용 */
export const Water: Story = { args: { species: 'water' } };
/** 꽃용 */
export const Flower: Story = { args: { species: 'flower' } };
/** 별용 */
export const Star: Story = { args: { species: 'star' } };
/** 긴 이름 (8자) */
export const LongName: Story = { args: { name: '용이용이용이용이' } };
