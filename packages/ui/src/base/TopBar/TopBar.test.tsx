import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StepProgress } from '../StepProgress';
import { TopBar } from './TopBar';
import styles from './TopBar.module.css';

const css = readFileSync(resolve(__dirname, 'TopBar.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

describe('TopBar (TopBar.md 테스트 기준)', () => {
  it("has a back button named '뒤로' that calls onBack", async () => {
    const onBack = vi.fn();
    render(<TopBar onBack={onBack} />);
    const back = screen.getByRole('button', { name: '뒤로' });
    expect(back).toHaveAttribute('type', 'button');
    await userEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('names the back button as given (Done, Tracking)', () => {
    render(<TopBar onBack={vi.fn()} backLabel="대화로 돌아가기" title="주문 현황" />);
    expect(screen.getByRole('button', { name: '대화로 돌아가기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '뒤로' })).toBeNull();
  });

  it('goes back with the keyboard too', async () => {
    const onBack = vi.fn();
    render(<TopBar onBack={onBack} />);
    screen.getByRole('button', { name: '뒤로' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has no back button without onBack', () => {
    render(<TopBar title="주문 상세" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([undefined, null, false])('has no spacer or trailing box for trailing %s', (trailing) => {
    const { container } = render(<TopBar title="주문 상세" trailing={trailing} />);
    expect(container.querySelector(`.${styles.spacer}`)).toBeNull();
    expect(container.querySelector(`.${styles.trailing}`)).toBeNull();
  });

  it('shows the title as the screen heading', () => {
    render(<TopBar onBack={vi.fn()} title="주문 상세" />);
    expect(screen.getByRole('heading', { level: 1, name: '주문 상세' })).toBeInTheDocument();
  });

  it('puts the trailing content after the back button', () => {
    const { container } = render(
      <TopBar onBack={vi.fn()} trailing={<StepProgress steps={['a', 'b', 'c']} current={2} />} />,
    );
    expect(screen.getByRole('progressbar', { name: '3단계 중 2단계' })).toBeInTheDocument();
    const bar = container.firstElementChild as HTMLElement;
    expect(Array.from(bar.children).map((c) => c.className)).toEqual([
      styles.back,
      styles.trailing,
    ]);
  });

  it('keeps alignment with a spacer when there is trailing content but no way back (Budget)', () => {
    const { container } = render(
      <TopBar trailing={<StepProgress steps={['a', 'b', 'c']} current={3} />} />,
    );
    const bar = container.firstElementChild as HTMLElement;
    expect(Array.from(bar.children).map((c) => c.className)).toEqual([
      styles.spacer,
      styles.trailing,
    ]);
    expect(bar.querySelector(`.${styles.spacer}`)).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the design chevron', () => {
    const { container } = render(<TopBar onBack={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('stroke-width', '2');
    expect(svg?.querySelector('path')).toHaveAttribute('d', 'M15 5l-7 7 7 7');
  });

  // Name.dc.html 22-23, Receipt.dc.html 22-24, Budget.dc.html 22-23.
  it('matches the design values', () => {
    expect(rule('.bar')).toMatch(/height:\s*var\(--size-top-bar\)/);
    expect(rule('.bar')).toMatch(/align-items:\s*center/);
    const back = rule('.back');
    expect(back).toMatch(/width:\s*var\(--size-touch-min\)/);
    expect(back).toMatch(/height:\s*var\(--size-touch-min\)/);
    expect(back).toMatch(/margin-left:\s*-10px/);
    expect(back).toMatch(/background:\s*transparent/);
    expect(back).toMatch(/color:\s*var\(--color-ink\)/);
    expect(rule('.back:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
    expect(rule('.icon')).toMatch(/width:\s*var\(--size-back-icon\)/);
    expect(rule('.spacer')).toMatch(/width:\s*calc\(var\(--size-touch-min\) - 10px\)/);
    expect(rule('.title')).toMatch(/font-size:\s*var\(--type-bar-title-size\)/);
    expect(rule('.title')).toMatch(/font-weight:\s*var\(--type-bar-title-weight\)/);
    expect(rule('.trailing')).toMatch(/flex-grow:\s*1/);
    expect(rule('.trailing')).toMatch(/margin-left:\s*var\(--space-2\)/);
  });
});
