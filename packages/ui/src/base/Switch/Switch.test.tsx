import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

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

  // Wallet.dc.html: 52 x 32 track, 26 knob, leaf on, line-strong off, 44px touch target.
  it('matches the design sizes, colors and touch target', () => {
    expect(rule('.track')).toMatch(/width:\s*var\(--size-switch-width\)/);
    expect(rule('.track')).toMatch(/height:\s*var\(--size-switch-height\)/);
    expect(rule('.track')).toMatch(/background:\s*var\(--color-line-strong\)/);
    expect(rule(".track[aria-checked='true']")).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(rule('.knob')).toMatch(/width:\s*var\(--size-switch-knob\)/);
    expect(rule('.knob')).toMatch(/background:\s*var\(--color-surface\)/);
    expect(rule('.track::after')).toMatch(/var\(--size-touch-min\)/);
  });

  it('moves the knob with translate only, and not under reduced motion', () => {
    expect(rule(".track[aria-checked='true'] .knob")).toMatch(/translate:\s*calc\(/);
    expect(css).not.toMatch(/\.knob[^{]*\{[^}]*(margin|left|right|justify-content)\s*:/);
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.knob\s*\{\s*transition:\s*none/,
    );
  });
});
