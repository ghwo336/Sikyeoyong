import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('../reduced-motion', () => ({ useShouldReduceMotion: () => reduced.value }));
beforeEach(() => {
  reduced.value = false;
});

const css = readFileSync(resolve(__dirname, 'Switch.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

function Labeled({ onChange }: { onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <span id="stop">용이 멈추기</span>
      <Switch
        checked={on}
        labelId="stop"
        onChange={(v) => {
          setOn(v);
          onChange?.(v);
        }}
      />
    </>
  );
}

describe('Switch (Switch.md 테스트 기준)', () => {
  it('is a switch with aria-checked and the visible label as its name', () => {
    render(<Labeled />);
    const sw = screen.getByRole('switch', { name: '용이 멈추기' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('type', 'button');
  });

  it('toggles with the keyboard space key, both ways', async () => {
    const onChange = vi.fn();
    render(<Labeled onChange={onChange} />);
    const sw = screen.getByRole('switch');
    sw.focus();
    await userEvent.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard(' ');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('asks for the opposite of the current value and leaves the state to the parent', async () => {
    const onChange = vi.fn();
    render(<Switch checked labelId="x" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  // Wallet.dc.html: 52 x 32 track, 26 knob, leaf on, ink-secondary off, 44px touch target.
  it('matches the design sizes, colors and touch target', () => {
    expect(rule('.track')).toMatch(/width:\s*var\(--size-switch-width\)/);
    expect(rule('.track')).toMatch(/height:\s*var\(--size-switch-height\)/);
    expect(rule('.track')).toMatch(/background:\s*var\(--color-ink-secondary\)/);
    expect(rule(".hit[aria-checked='true'] .track")).toMatch(/background:\s*var\(--theme-accent\)/);
    expect(rule('.knob')).toMatch(/width:\s*var\(--size-switch-knob\)/);
    expect(rule('.knob')).toMatch(/background:\s*var\(--color-surface\)/);
    // 3px padding: (32 - 26) / 2
    expect(rule('.track')).toMatch(
      /padding:\s*calc\(\(var\(--size-switch-height\) - var\(--size-switch-knob\)\) \/ 2\)/,
    );
    // The button itself is the 44px finger target (browser QA measured the element at 52 x 32);
    // the 32px track is drawn inside it.
    expect(rule('.hit')).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(rule('.hit')).toMatch(/background:\s*transparent/);
  });

  it('moves the knob with translate only, and not under reduced motion', () => {
    // travel = inner width 46 - knob 26 = 20 = width - height
    expect(rule(".hit[aria-checked='true'] .knob")).toMatch(
      /translate:\s*calc\(var\(--size-switch-width\) - var\(--size-switch-height\)\) 0;/,
    );
    expect(rule('.knob')).toMatch(/transition:\s*translate /);
    expect(css).not.toMatch(/\.knob[^{]*\{[^}]*(margin|left|right|justify-content)\s*:/);
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.knob\s*\{\s*transition:\s*none/,
    );
  });

  it('stretches the knob while pressed', async () => {
    render(<Switch checked={false} labelId="x" onChange={vi.fn()} />);
    const knob = screen.getByRole('switch').querySelector<HTMLElement>('span > span');
    fireEvent.pointerDown(screen.getByRole('switch'), { isPrimary: true, button: 0 });
    await waitFor(() => {
      expect(knob?.style.transform).toMatch(/scaleX\(/);
    });
  });

  it('does not stretch the knob under reduced motion', async () => {
    reduced.value = true;
    render(<Switch checked={false} labelId="x" onChange={vi.fn()} />);
    const knob = screen.getByRole('switch').querySelector<HTMLElement>('span > span');
    fireEvent.pointerDown(screen.getByRole('switch'), { isPrimary: true, button: 0 });
    await new Promise((r) => setTimeout(r, 100));
    expect(knob?.style.transform ?? '').not.toMatch(/scaleX/);
  });
});

// WCAG 1.4.11: the off track is the only sign of the control's edge, so 3:1 against both grounds.
describe('Switch off track contrast', () => {
  const tokens = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../../design/tokens.json'), 'utf8'),
  ) as { color: Record<string, string> };
  const luminance = (hex: string) => {
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const offColor = () => {
    const name = /background:\s*var\(--color-([a-z-]+)\)/.exec(rule('.track'))?.[1] ?? '';
    return tokens.color[name.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())] ?? '';
  };

  it.each(['ground', 'surface'])('is at least 3:1 against %s', (ground) => {
    expect(ratio(offColor(), tokens.color[ground] ?? '')).toBeGreaterThanOrEqual(3);
  });

  it('the old line-strong would fail (the check can fail)', () => {
    expect(ratio(tokens.color.lineStrong ?? '', tokens.color.ground ?? '')).toBeLessThan(3);
  });
});
