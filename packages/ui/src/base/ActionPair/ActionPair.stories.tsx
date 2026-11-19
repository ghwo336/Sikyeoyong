import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../Button';
import { ActionPair } from './ActionPair';

// Harness states from docs/wiki/components/ui/base/ActionPair.md.
const meta = {
  title: 'base/ActionPair',
  component: ActionPair,
  decorators: [(Story) => <div style={{ width: 342 }}>{Story()}</div>],
} satisfies Meta<typeof ActionPair>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => undefined;

/** 확인 시트 (xs 4): 시키기와 다시 고를래 */
export const Confirm: Story = {
  args: {
    gap: 'xs',
    primary: (
      <Button variant="primary" onPress={noop}>
        9,000원 시키기
      </Button>
    ),
    secondary: (
      <Button variant="text" onPress={noop}>
        다시 고를래
      </Button>
    ),
  },
};

/** 한도 바꾸기 카드 (sm 6) */
export const LimitChange: Story = {
  args: {
    gap: 'sm',
    primary: (
      <Button variant="primary" size="choice" onPress={noop}>
        바꾸기
      </Button>
    ),
    secondary: (
      <Button variant="text" size="md" onPress={noop}>
        그만두기
      </Button>
    ),
  },
};

/** 주 버튼 없음 (md 8, 맨 위 레벨의 막힘) */
export const SecondaryOnly: Story = {
  args: {
    gap: 'md',
    secondary: (
      <Button variant="secondary" size="choice" onPress={noop}>
        10,000원 안에서 다시 고르기
      </Button>
    ),
  },
};
