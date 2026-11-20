import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveOrderCard, type ActiveOrderCardProps } from './ActiveOrderCard';

const css = readFileSync(resolve(__dirname, 'ActiveOrderCard.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

const base: ActiveOrderCardProps = {
  menu: '돼지국밥',
  status: '배달 중',
  eta: '8분 남았어요',
  steps: ['주문 접수', '조리 중', '배달 중', '도착'],
  current: 3,
  onPress: () => undefined,
};

describe('ActiveOrderCard (ActiveOrderCard.md 테스트 기준)', () => {
  it('is one button named like the design: what, where it is and when', () => {
    render(<ActiveOrderCard {...base} />);
    expect(
      screen.getByRole('button', { name: '진행 중인 주문: 돼지국밥 배달 중, 8분 남았어요' }),
    ).toBeInTheDocument();
    expect(screen.getByText('돼지국밥 배달 중')).toBeInTheDocument();
    expect(screen.getByText('8분 남았어요')).toBeInTheDocument();
  });

  it('fills the steps up to the current one', () => {
    const { container } = render(<ActiveOrderCard {...base} current={2} />);
    expect(container.querySelectorAll('[data-done]')).toHaveLength(2);
  });

  it('calls onPress once per press', async () => {
    const onPress = vi.fn();
    render(<ActiveOrderCard {...base} onPress={onPress} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses the theme color for the line, the mark and the time (D-32), the Main design values', () => {
    expect(rule('.card')).toMatch(/border:\s*1\.5px solid var\(--theme-accent\)/);
    expect(rule('.card')).toMatch(/border-radius:\s*var\(--radius-budget-card\)/);
    expect(rule('.card')).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(rule('.mark')).toMatch(/background:\s*var\(--theme-accent\)/);
    expect(rule('.eta')).toMatch(/color:\s*var\(--theme-accent\)/);
    expect(rule('.title')).toMatch(/font-size:\s*var\(--type-small-size\)/);
  });
});
