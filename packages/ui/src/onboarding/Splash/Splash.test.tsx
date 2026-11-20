import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Splash } from './Splash';

const css = readFileSync(resolve(__dirname, 'Splash.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:>]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';
const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

describe('Splash (Splash.md 테스트 기준)', () => {
  it('says the design words, and the waiting line is a status for screen readers', () => {
    render(<Splash species="forest" />);
    expect(screen.getByText('시켜용')).toBeInTheDocument();
    expect(screen.getByText('배달은 용이한테 시켜용')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('용이를 깨우는 중이에요');
    // Not the design's "마루 테스트넷 데모": no chain words on screen (D-17).
    expect(screen.getByText('체험용 데모')).toBeInTheDocument();
    expect(screen.queryByText(/테스트넷|마루/)).toBeNull();
  });

  it.each(['forest', 'water', 'flower', 'star'] as const)(
    'draws the %s dragon at 168 with its white edge, both decoration',
    (species) => {
      const { container } = render(<Splash species={species} />);
      const dragon = container.querySelector(`svg[data-species='${species}']`);
      expect(dragon).toHaveAttribute('width', '168');
      for (const svg of container.querySelectorAll('svg')) {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      }
    },
  );

  it('a press anywhere calls onSkip once', async () => {
    const onSkip = vi.fn();
    render(<Splash species="forest" onSkip={onSkip} />);
    await userEvent.click(screen.getByText('체험용 데모'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('skips from the keyboard too: a button named 시켜용 시작하기, Enter or Space', async () => {
    const onSkip = vi.fn();
    render(<Splash species="forest" onSkip={onSkip} />);
    const skip = screen.getByRole('button', { name: '시켜용 시작하기' });
    skip.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it('is no button without onSkip', () => {
    render(<Splash species="forest" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is the theme color with white words (D-32 loading background), and fades in', () => {
    expect(rule('.splash')).toMatch(/background:\s*var\(--theme-accent\)/);
    expect(rule('.splash')).toMatch(/color:\s*var\(--color-surface\)/);
    expect(rule('.splash')).toMatch(/animation:\s*splash-in var\(--motion-screen\)/);
    expect(rule('.dot')).toMatch(/background:\s*var\(--color-yolk\)/);
    expect(rule('.title')).toMatch(/font-family:\s*var\(--font-dragon\)/);
  });

  it('moves only by transform and opacity, and stops bobbing and hopping under reduced motion', () => {
    const frames = [...css.matchAll(/@keyframes [\w-]+\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    expect(frames.length).toBe(4);
    for (const f of frames) {
      const props = [...(f ?? '').matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(props.every((p) => p === 'transform' || p === 'opacity')).toBe(true);
    }
    expect(reduced).toMatch(/\.bob,\s*\.shadow,\s*\.dot\s*\{\s*animation:\s*none;/);
    // The fade-in is opacity only, so it stays.
    expect(reduced).not.toMatch(/\.splash/);
  });
});
