import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { radioGroupKeyDown, radioTabIndex } from './radio-group';

function Group({ initial = -1 }: { initial?: number }) {
  const [sel, setSel] = useState(initial);
  const items = ['가', '나', '다'];
  return (
    <>
      <button type="button">앞</button>
      <div role="radiogroup" aria-label="고르기" onKeyDown={radioGroupKeyDown(setSel)}>
        {items.map((label, i) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={sel === i}
            tabIndex={radioTabIndex(i, sel)}
            onClick={() => {
              setSel(i);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <button type="button">뒤</button>
    </>
  );
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('radio group keyboard (WAI-ARIA)', () => {
  it('enters on the first item when none is checked, and leaves with one more Tab', async () => {
    render(<Group />);
    screen.getByRole('button', { name: '앞' }).focus();
    await userEvent.tab();
    expect(radio('가')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: '뒤' })).toHaveFocus();
  });

  it('enters on the checked item', async () => {
    render(<Group initial={1} />);
    screen.getByRole('button', { name: '앞' }).focus();
    await userEvent.tab();
    expect(radio('나')).toHaveFocus();
  });

  it('moves and selects with arrows, wrapping both ways', async () => {
    render(<Group initial={0} />);
    radio('가').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(radio('나')).toHaveFocus();
    expect(radio('나')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(radio('가')).toHaveFocus(); // wrapped
    await userEvent.keyboard('{ArrowLeft}');
    expect(radio('다')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(radio('나')).toHaveAttribute('aria-checked', 'true');
  });

  it('jumps with Home and End', async () => {
    render(<Group initial={1} />);
    radio('나').focus();
    await userEvent.keyboard('{End}');
    expect(radio('다')).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Home}');
    expect(radio('가')).toHaveAttribute('aria-checked', 'true');
  });

  it('stops the page from scrolling on handled keys only', () => {
    render(<Group initial={0} />);
    radio('가').focus();
    // fireEvent returns false when the default was prevented
    expect(fireEvent.keyDown(radio('가'), { key: 'ArrowDown' })).toBe(false);
    expect(fireEvent.keyDown(radio('나'), { key: 'a' })).toBe(true);
  });

  it('leaves Alt, Ctrl and Cmd with arrows to the browser', () => {
    render(<Group initial={0} />);
    radio('가').focus();
    for (const mod of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(fireEvent.keyDown(radio('가'), { key: 'ArrowLeft', ...mod })).toBe(true);
    }
    expect(radio('가')).toHaveAttribute('aria-checked', 'true');
  });

  it('gives tab index 0 to exactly one item', () => {
    expect([0, 1, 2].map((i) => radioTabIndex(i, -1))).toEqual([0, -1, -1]);
    expect([0, 1, 2].map((i) => radioTabIndex(i, 2))).toEqual([-1, -1, 0]);
  });
});
