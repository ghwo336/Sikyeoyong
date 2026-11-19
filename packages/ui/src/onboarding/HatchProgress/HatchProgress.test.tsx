import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type HatchStep, HatchProgress } from './HatchProgress';

const css = readFileSync(resolve(__dirname, 'HatchProgress.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

// The retry button is base Button; its size lives in Button.module.css.
const buttonCss = readFileSync(resolve(__dirname, '../../base/Button/Button.module.css'), 'utf8');
const buttonRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(buttonCss)?.[2] ??
  '';

const LABELS = ['용이 용돈 주머니 만들기', '용이 신분증 만들기', '한 번에 쓸 수 있는 돈 새기기'];
const steps = (...s: HatchStep['status'][]): HatchStep[] =>
  LABELS.map((label, i) => ({ label, status: s[i] ?? 'waiting' }));

describe('HatchProgress (HatchProgress.md 테스트 기준)', () => {
  it('shows the retry button only on a failed step', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <HatchProgress steps={steps('done', 'doing', 'waiting')} onRetry={onRetry} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<HatchProgress steps={steps('done', 'failed', 'waiting')} onRetry={onRetry} />);
    const items = screen.getAllByRole('listitem');
    const retry = within(items[1] as HTMLElement).getByRole('button', { name: '다시 깨우기' });
    await userEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('says it failed without a dead button when there is no onRetry', () => {
    render(<HatchProgress steps={steps('done', 'failed', 'waiting')} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('안 됐어요')).toBeInTheDocument();
  });

  it('shows each step with its state word, in order', () => {
    render(<HatchProgress steps={steps('done', 'doing', 'waiting')} />);
    expect(screen.getByRole('list', { name: '알 깨우기 단계' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '용이 용돈 주머니 만들기완료',
      '용이 신분증 만들기하는 중',
      '한 번에 쓸 수 있는 돈 새기기대기',
    ]);
  });

  it('draws the icon of each state', () => {
    const { container } = render(<HatchProgress steps={steps('done', 'doing', 'failed')} />);
    const icons = Array.from(container.querySelectorAll('svg'));
    expect(icons.map((i) => i.getAttribute('data-status'))).toEqual(['done', 'doing', 'failed']);
    expect(icons[0]?.querySelector('path')).toHaveAttribute('d', 'M7.5 12.5l3 3 6-6.5');
    expect(icons[1]?.querySelector('path')).toHaveAttribute('d', 'M12 2.5 A9.5 9.5 0 0 1 21.5 12');
    // failed: an amber ring with an exclamation mark
    expect(icons[2]?.querySelector('circle')).toHaveClass('failRing');
    expect(icons[2]?.querySelector('path')).toHaveAttribute('d', 'M12 7v6M12 16.5v.5');
    for (const i of icons) expect(i).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws waiting as one grey ring and nothing else', () => {
    const { container } = render(<HatchProgress steps={steps('waiting', 'waiting', 'waiting')} />);
    const icon = container.querySelector('svg');
    expect(icon?.querySelectorAll('circle')).toHaveLength(1);
    expect(icon?.querySelector('circle')).toHaveClass('waitRing');
    expect(icon?.querySelector('path')).toBeNull();
  });

  it('tells screen readers the step failed, even next to the retry button', () => {
    render(<HatchProgress steps={steps('done', 'failed', 'waiting')} onRetry={vi.fn()} />);
    const failed = screen.getAllByRole('listitem')[1] as HTMLElement;
    expect(failed).toHaveTextContent('용이 신분증 만들기안 됐어요다시 깨우기');
  });

  it('spins the arc, but not under reduced motion', () => {
    expect(rule('.arc')).toMatch(/animation:\s*spin/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*\.arc\s*\{\s*animation:\s*none/);
  });

  // Hatch.dc.html 27-31.
  it('matches the design values', () => {
    const list = rule('.list');
    expect(list).toMatch(/padding:\s*var\(--space-4\)/);
    expect(list).toMatch(/gap:\s*var\(--size-limits-gap\)/);
    expect(list).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(list).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(rule('.step')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.step')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule(".step[data-status='doing']")).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule(".step[data-status='waiting']")).toMatch(/color:\s*var\(--color-ink-muted\)/);
    expect(rule(".step[data-status='doing'] .state")).toMatch(/color:\s*var\(--color-leaf\)/);
    expect(rule('.state')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.doneDot')).toMatch(/fill:\s*var\(--color-leaf\)/);
    expect(rule('.waitRing')).toMatch(/stroke:\s*var\(--color-line-strong\)/);
    expect(rule('.failRing')).toMatch(/stroke:\s*var\(--color-over\)/);
    expect(rule(".step[data-status='failed'] .state")).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(rule('.icon')).toMatch(/width:\s*var\(--size-status-icon\)/);
    // Retry: Button link sm (leaf, 13/600, 44 tall).
    render(
      <HatchProgress
        steps={[{ label: '용이 신분증 만들기', status: 'failed' }]}
        onRetry={() => undefined}
      />,
    );
    const retry = screen.getByRole('button', { name: '다시 깨우기' });
    expect([...retry.classList]).toEqual(expect.arrayContaining(['link', 'sm']));
    expect(buttonRule('.sm')).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(buttonRule('.sm')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(buttonRule('.sm')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
  });
});
