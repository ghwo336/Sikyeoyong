import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatHeader } from './ChatHeader';

const css = readFileSync(resolve(__dirname, 'ChatHeader.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const base = { name: '용이', caption: '한 번에 10,000원까지', species: 'forest' } as const;

describe('ChatHeader (ChatHeader.md 테스트 기준)', () => {
  it('shows a 44px dragon of the species, the name and the caption in order', () => {
    const { container } = render(<ChatHeader {...base} species="water" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '44');
    expect(svg).toHaveAttribute('data-species', 'water');
    expect(svg).toHaveAttribute('data-mood', 'default');
    // The name is the chat screen's heading; the caption follows it.
    const heading = screen.getByRole('heading', { level: 1, name: '용이' });
    expect(heading.nextElementSibling).toHaveTextContent('한 번에 10,000원까지');
  });

  it('opens settings once per press with a button named after the dragon', async () => {
    const onSettings = vi.fn();
    render(<ChatHeader {...base} name="봄봄" onSettings={onSettings} />);
    await userEvent.click(screen.getByRole('button', { name: '봄봄 설정' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('has no button without onSettings (LimitChat)', () => {
    render(<ChatHeader {...base} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Main.dc.html 22-28.
  it('matches the design values', () => {
    expect(rule('.header')).toMatch(/align-items:\s*center/);
    expect(rule('.header')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.text')).toMatch(/flex-grow:\s*1/);
    expect(rule('.text')).toMatch(/gap:\s*2px/);
    expect(rule('.name')).toMatch(/font-size:\s*var\(--type-heading-size\)/);
    expect(rule('.name')).toMatch(/font-weight:\s*var\(--type-heading-weight\)/);
    expect(rule('.caption')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.caption')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });
});
