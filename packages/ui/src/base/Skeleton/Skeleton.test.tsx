import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

const css = readFileSync(resolve(__dirname, 'Skeleton.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('Skeleton (Skeleton.md 테스트 기준)', () => {
  it('is hidden from screen readers (the busy parent speaks for it)', () => {
    const { container } = render(<Skeleton height="caption" width="7.5em" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes the width and the height class of the text it stands for', () => {
    const { container } = render(<Skeleton height="walletAmount" width="10em" />);
    const bar = container.firstElementChild as HTMLElement;
    expect(bar.style.width).toBe('10em');
    expect(bar.classList).toContain('walletAmount');
  });

  it('passes data marks through', () => {
    const { container } = render(<Skeleton height="meta" width="40%" data-part="skeleton" />);
    expect(container.querySelectorAll('[data-part="skeleton"]')).toHaveLength(1);
  });

  it('never moves: no animation or transition', () => {
    expect(css).not.toMatch(/animation|transition|@keyframes/);
  });

  it('matches the token heights and the track color', () => {
    expect(rule('.bar')).toMatch(/background:\s*var\(--color-track\)/);
    expect(rule('.bar')).toMatch(/border-radius:\s*var\(--radius-chip\)/);
    expect(rule('.walletAmount')).toMatch(/height:\s*var\(--type-wallet-amount-size\)/);
    expect(rule('.caption')).toMatch(/height:\s*var\(--type-caption-size\)/);
    expect(rule('.meta')).toMatch(/height:\s*var\(--type-meta-size\)/);
  });
});
