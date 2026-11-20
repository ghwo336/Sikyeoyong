import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, type IconName } from './Icon';

// Harness states from docs/wiki/components/ui/base/Icon.md.
const meta = {
  title: 'base/Icon',
  component: Icon,
  args: { name: 'chevron-right' },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

const NAMES: readonly IconName[] = [
  'back',
  'chevron-right',
  'chevron-down',
  'arrow-right',
  'arrow-up',
  'face-id',
  'kakao',
  'more',
];

/** 전부 (24px, 글자색) */
export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      {NAMES.map((n) => (
        <span key={n} style={{ display: 'inline-flex', width: 24, height: 24 }}>
          <Icon name={n} />
        </span>
      ))}
    </div>
  ),
};

/** 부르는 쪽이 크기와 색을 정함 (잎색 32px) */
export const SizedByCaller: Story = {
  render: () => (
    <span style={{ display: 'inline-flex', width: 32, height: 32, color: 'var(--theme-accent)' }}>
      <Icon name="arrow-up" />
    </span>
  ),
};
