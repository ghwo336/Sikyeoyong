import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

const css = readFileSync(resolve(__dirname, 'Chip.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`${selector.replace(/[.[\]]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ??
  '';

describe('Chip (Chip.md 테스트 기준)', () => {
  it('exposes aria-checked as a radio when it is a choice', () => {
    const { rerender } = render(
      <Chip selected onPress={() => undefined}>
        또 먹을래
      </Chip>,
    );
    expect(screen.getByRole('radio', { name: '또 먹을래' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    rerender(
      <Chip selected={false} onPress={() => undefined}>
        또 먹을래
      </Chip>,
    );
    expect(screen.getByRole('radio', { name: '또 먹을래' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('is a plain button for quick replies (no selected prop)', () => {
    render(<Chip onPress={() => undefined}>돼지국밥으로</Chip>);
    const button = screen.getByRole('button', { name: '돼지국밥으로' });
    expect(button).not.toHaveAttribute('aria-checked');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('calls onPress once per press, by mouse and keyboard', async () => {
    const onPress = vi.fn();
    render(<Chip onPress={onPress}>더 싼 거 없어?</Chip>);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.keyboard('{Enter}');
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  // Design values: Main quick reply 36px pill 14px, Budget and Arrived 52px tile radius 14,
  // selected 2px leaf border on leaf tint.
  it('matches the design sizes and the selected look', () => {
    expect(rule('.sm')).toMatch(/height:\s*var\(--size-chip\)/);
    expect(rule('.sm')).toMatch(/font-size:\s*var\(--type-chip-size\)/);
    expect(rule('.lg')).toMatch(/min-height:\s*var\(--size-input\)/);
    expect(rule('.lg')).toMatch(/border-radius:\s*var\(--radius-input\)/);
    expect(rule('.chip[data-selected]')).toMatch(/border:\s*2px solid var\(--color-leaf\)/);
    expect(rule('.chip[data-selected]')).toMatch(/background:\s*var\(--color-leaf-tint\)/);
  });

  it('keeps a 44px touch target for the 36px pill', () => {
    expect(rule('.sm::after')).toMatch(
      /inset:\s*calc\(\(var\(--size-touch-min\) - var\(--size-chip\)\) \/ -2\) 0/,
    );
    expect(rule('.chip')).toMatch(/position:\s*relative/);
  });

  it('puts the size, selected and numeric marks on the element', () => {
    render(
      <Chip size="lg" numeric selected onPress={() => undefined}>
        300,000원
      </Chip>,
    );
    const el = screen.getByRole('radio');
    expect(el.classList).toContain('lg');
    expect(el.classList).toContain('numeric');
    expect(el).toHaveAttribute('data-selected', 'true');
    expect(rule('.numeric')).toMatch(/tabular-nums/);
  });
});
