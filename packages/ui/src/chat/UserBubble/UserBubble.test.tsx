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

  it('shows the text as typed, line breaks kept', () => {
    render(<UserBubble text={'첫 줄\n둘째 줄'} />);
    expect(screen.getByText(/첫 줄/).textContent).toBe('첫 줄\n둘째 줄');
    expect(rule('.bubble')).toMatch(/white-space:\s*pre-wrap/);
  });

  it('marks sending as busy and sent as not', () => {
    const { container, rerender } = render(<UserBubble text={text} status="sending" />);
    const wrap = container.firstElementChild;
    expect(wrap).toHaveAttribute('aria-busy', 'true');
    expect(wrap).toHaveAttribute('data-status', 'sending');
    rerender(<UserBubble text={text} />);
    expect(container.firstElementChild).not.toHaveAttribute('aria-busy');
    expect(container.firstElementChild).toHaveAttribute('data-status', 'sent');
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
    expect(rule(".wrap[data-status='sending'] .bubble")).toMatch(/opacity:\s*0\.6/);
    expect(rule('.failed')).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(rule('.retry')).toMatch(/color:\s*var\(--color-leaf\)/);
    expect(rule('.retry::after')).toMatch(
      /inset:\s*calc\(\(var\(--size-touch-min\) - 1em\) \/ -2\)/,
    );
    expect(rule('.retry:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
  });
});
