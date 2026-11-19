import type { Meta, StoryObj } from '@storybook/react-vite';
import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { MotionConfig } from 'motion/react';
import { Egg } from './Egg';

// Harness states from docs/wiki/components/ui/dragon/Egg.md.
const meta: Meta<typeof Egg> = {
  title: 'dragon/Egg',
  component: Egg,
  args: { state: 'closed', species: 'forest', size: 120 },
};

export default meta;
type Story = StoryObj<typeof Egg>;

/** 닫힘 */
export const Closed: Story = {};

/** 흔들림 (움직임) */
export const Wobble: Story = { args: { state: 'wobble' } };

/** 잠듦 Zz */
export const Sleeping: Story = { args: { state: 'sleeping', size: 168 } };

/** 종 4가지 무늬 (잎 점, 물결, 꽃잎 점, 별과 달) */
export const Species: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
      {DRAGON_SPECIES.map((species) => (
        <Egg key={species} state="closed" species={species} size={120} />
      ))}
    </div>
  ),
};

/** 동작 줄이기: 흔들림 상태여도 흔들지 않는다 */
export const WobbleReducedMotion: Story = {
  args: { state: 'wobble' },
  render: (args) => (
    <MotionConfig reducedMotion="always">
      <Egg {...args} />
    </MotionConfig>
  ),
};
