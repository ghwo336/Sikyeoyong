import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Chip } from './Chip';

// Harness states from docs/wiki/components/ui/base/Chip.md.
const meta: Meta<typeof Chip> = {
  title: 'base/Chip',
  component: Chip,
  args: { children: '돼지국밥으로', onPress: () => undefined },
};

export default meta;
type Story = StoryObj<typeof Chip>;

/** 기본 (Main 빠른 답장) */
export const Default: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <Chip {...args}>돼지국밥으로</Chip>
      <Chip {...args}>더 싼 거 없어?</Chip>
    </div>
  ),
};

function TastePicker() {
  const [picked, setPicked] = useState('또 먹을래');
  // Arrived uses the tile look (15px regular); shown here as a choice group.
  return (
    <div
      role="radiogroup"
      aria-label="맛 평가"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-2)',
        width: 342,
      }}
    >
      {['또 먹을래', '괜찮았어', '별로였어'].map((label) => (
        <Chip
          key={label}
          size="tile"
          selected={picked === label}
          onPress={() => {
            setPicked(label);
          }}
        >
          {label}
        </Chip>
      ))}
    </div>
  );
}

function BudgetPicker() {
  const [picked, setPicked] = useState('30만 원');
  return (
    <div
      role="radiogroup"
      aria-label="이번 달 배달 예산"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 'var(--space-2)',
        width: 342,
      }}
    >
      {/* Budget.dc.html labels; the short won format is open question Q-23. */}
      {['20만 원', '30만 원', '50만 원'].map((label) => (
        <Chip
          key={label}
          size="lg"
          numeric
          selected={picked === label}
          onPress={() => {
            setPicked(label);
          }}
        >
          {label}
        </Chip>
      ))}
    </div>
  );
}

/** 선택됨 (Arrived 맛 평가) */
export const Selected: Story = { render: () => <TastePicker /> };

/** 고정폭 숫자 (Budget 예산 고르기) */
export const Numeric: Story = { render: () => <BudgetPicker /> };
