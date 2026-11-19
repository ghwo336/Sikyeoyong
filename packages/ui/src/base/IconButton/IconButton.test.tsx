import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

const css = readFileSync(resolve(__dirname, 'IconButton.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

describe('IconButton (IconButton.md 테스트 기준)', () => {
  it('is a button named by label that calls onPress once per press, by click or Enter', async () => {
    const onPress = vi.fn();
    render(<IconButton icon="more" label="용이 설정" onPress={onPress} />);
    const button = screen.getByRole('button', { name: '용이 설정' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('shows only the icon, hidden from screen readers', () => {
    const { container } = render(<IconButton icon="back" label="뒤로" onPress={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-icon', 'back');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button').textContent).toBe('');
  });

  it('is pulled to the screen edge only when asked', () => {
    const { rerender } = render(<IconButton icon="back" label="뒤로" onPress={vi.fn()} />);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-edge');
    rerender(<IconButton icon="back" label="뒤로" onPress={vi.fn()} edge="start" />);
    expect(screen.getByRole('button')).toHaveAttribute('data-edge', 'start');
  });

  // Name.dc.html back, Main.dc.html settings.
  it('matches the design values', () => {
    const button = rule('.button');
    expect(button).toMatch(/width:\s*var\(--size-touch-min\)/);
    expect(button).toMatch(/height:\s*var\(--size-touch-min\)/);
    expect(button).toMatch(/background:\s*transparent/);
    expect(button).toMatch(/color:\s*var\(--color-ink\)/);
    expect(rule(".button[data-edge='start']")).toMatch(/margin-left:\s*-10px/);
    expect(rule('.button:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
    expect(rule('.icon')).toMatch(/width:\s*var\(--size-back-icon\)/);
    expect(rule('.icon')).toMatch(/height:\s*var\(--size-back-icon\)/);
  });
});
