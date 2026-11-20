import type { Meta, StoryObj } from '@storybook/react-vite';
import { Splash } from './Splash';

// Harness states from docs/wiki/components/ui/onboarding/Splash.md. Values from Splash.dc.html.
// The background is the theme color: each story wraps itself in its species.
const meta = {
  title: 'onboarding/Splash',
  component: Splash,
  parameters: { layout: 'fullscreen' },
  args: { species: 'forest' },
  decorators: [
    (Story, ctx) => (
      <div style={{ width: 390, height: 844 }} data-species={ctx.args.species}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Splash>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 숲용 (기본, 처음 오는 기기) */
export const Forest: Story = {};
/** 물용 */
export const Water: Story = { args: { species: 'water' } };
/** 꽃용 */
export const Flower: Story = { args: { species: 'flower' } };
/** 별용 */
export const Star: Story = { args: { species: 'star' } };
