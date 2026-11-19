import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { MotionConfig } from 'motion/react';
import { Button } from '../Button';
import { Amount, type AmountProps } from './Amount';

// Harness states from docs/wiki/components/ui/base/Amount.md.
const meta: Meta<typeof Amount> = {
  title: 'base/Amount',
  component: Amount,
  args: { value: okrwToAokrw(45_000n), size: 'display' },
};

export default meta;
type Story = StoryObj<typeof Amount>;

/** 정적 */
export const Static: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Amount value={okrwToAokrw(45_000n)} size="display" />
      <Amount value={okrwToAokrw(9_000n)} size="title" />
      <Amount value={okrwToAokrw(1_234_567n)} size="row" />
    </div>
  ),
};

function Changing(props: Pick<AmountProps, 'size'>) {
  const [won, setWon] = useState(9_000n);
  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
      <Amount value={okrwToAokrw(won)} size={props.size} animate />
      <Button
        variant="secondary"
        size="md"
        onPress={() => {
          setWon((w) => (w === 9_000n ? 45_000n : 9_000n));
        }}
      >
        값 바꾸기
      </Button>
    </div>
  );
}

/** 값 변경 애니메이션 */
export const Rolling: Story = { render: () => <Changing size="display" /> };

/** 동작 줄이기 설정: 기기 설정과 상관없이 굴림 없이 바로 바뀐다 */
export const ReducedMotion: Story = {
  render: () => (
    <MotionConfig reducedMotion="always">
      <Changing size="title" />
    </MotionConfig>
  ),
};
