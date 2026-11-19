import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserBubble } from './UserBubble';

const css = readFileSync(resolve(__dirname, 'UserBubble.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

// The retry button is base Button; its size lives in Button.module.css.
const buttonCss = readFileSync(resolve(__dirname, '../../base/Button/Button.module.css'), 'utf8');
const buttonRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(buttonCss)?.[2] ??
  '';

const text = '점심 시켜 줘. 따뜻한 걸로';

describe('UserBubble (UserBubble.md 테스트 기준)', () => {
  it('shows the retry button only when failed', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<UserBubble text={text} onRetry={onRetry} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<UserBubble text={text} status="sending" onRetry={onRetry} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<UserBubble text={text} status="failed" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 보내기' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('못 보냈어요')).toBeInTheDocument();
  });

  it('says it failed even without a retry callback, but draws no dead button', () => {
    render(<UserBubble text={text} status="failed" />);
    expect(screen.getByText('못 보냈어요')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the text as typed, line breaks and spaces kept', () => {
    const { container } = render(<UserBubble text={'  첫 줄\n둘째 줄 '} />);
    expect(container.querySelector('p')?.textContent).toBe('  첫 줄\n둘째 줄 ');
    expect(rule('.bubble')).toMatch(/white-space:\s*pre-wrap/);
  });

  it('marks sending as busy and sent as not', () => {
    const { container, rerender } = render(<UserBubble text={text} status="sending" />);
    const wrap = container.firstElementChild;
    expect(wrap).toHaveAttribute('aria-busy', 'true');
    expect(wrap).toHaveAttribute('data-status', 'sending');
    expect(screen.getByText('보내는 중')).toBeInTheDocument();
    rerender(<UserBubble text={text} />);
    expect(container.firstElementChild).not.toHaveAttribute('aria-busy');
    expect(container.firstElementChild).toHaveAttribute('data-status', 'sent');
    expect(screen.queryByText('보내는 중')).toBeNull();
  });

  // Main.dc.html line 42.
  it('matches the design values', () => {
    expect(rule('.wrap')).toMatch(/align-self:\s*flex-end/);
    expect(rule('.wrap')).toMatch(/max-width:\s*var\(--size-bubble-max\)/);
    const b = rule('.bubble');
    expect(b).toMatch(/padding:\s*var\(--size-bubble-pad-y\) var\(--space-4\)/);
    expect(b).toMatch(
      /border-radius:\s*var\(--radius-bubble\) var\(--radius-bubble\) var\(--radius-bubble-tail\)\s+var\(--radius-bubble\)/,
    );
    expect(b).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(b).toMatch(/color:\s*var\(--color-surface\)/);
    expect(b).toMatch(/font-size:\s*var\(--type-bubble-size\)/);
    expect(b).toMatch(/line-height:\s*var\(--type-bubble-line-height\)/);
    expect(css).not.toMatch(/opacity/);
    expect(b).toMatch(/word-break:\s*keep-all/);
    expect(rule('.note')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.failed')).toMatch(/color:\s*var\(--color-over-ink\)/);
    // Retry: Button link sm (leaf text, 44 tall on its own, no ::after that could cover the bubble).
    render(<UserBubble text="안녕" status="failed" onRetry={() => undefined} />);
    const retry = screen.getByRole('button', { name: '다시 보내기' });
    expect([...retry.classList]).toEqual(expect.arrayContaining(['link', 'sm']));
    expect(buttonRule('.link')).toMatch(/color:\s*var\(--color-leaf\)/);
    expect(buttonRule('.sm')).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(buttonCss).not.toMatch(/::after/);
    expect(buttonRule('.button:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
  });
});
