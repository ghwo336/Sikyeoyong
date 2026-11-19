import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_OFFSET, CLOSE_VELOCITY, SHEET_SPRING, Sheet, shouldClose } from './Sheet';
import styles from './Sheet.module.css';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('../reduced-motion', () => ({ useShouldReduceMotion: () => reduced.value }));
beforeEach(() => {
  reduced.value = false;
});

const css = readFileSync(resolve(__dirname, 'Sheet.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

function Body() {
  return (
    <>
      <button type="button">하나</button>
      <button type="button">둘</button>
    </>
  );
}

describe('Sheet (Sheet.md 테스트 기준)', () => {
  it('is a modal dialog named by label when open, nothing when closed', () => {
    const { rerender } = render(
      <Sheet open label="주문 확인" onClose={vi.fn()}>
        <Body />
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: '주문 확인' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    rerender(
      <Sheet open={false} label="주문 확인" onClose={vi.fn()}>
        <Body />
      </Sheet>,
    );
    // AnimatePresence may keep it for the exit, but it is gone once the exit ends.
    return vi.waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="주문 확인" onClose={onClose}>
        <Body />
      </Sheet>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on a press outside, not inside', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open label="주문 확인" onClose={onClose}>
        <Body />
      </Sheet>,
    );
    await userEvent.click(screen.getByRole('button', { name: '하나' }));
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    const scrim = container.ownerDocument.querySelector('[data-part="scrim"]');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(scrim as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus in, traps Tab both ways, and gives focus back on close', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            열기
          </button>
          <Sheet
            open={open}
            label="주문 확인"
            onClose={() => {
              setOpen(false);
            }}
          >
            <Body />
          </Sheet>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '열기' });
    await userEvent.click(opener);
    const one = screen.getByRole('button', { name: '하나' });
    const two = screen.getByRole('button', { name: '둘' });
    expect(one).toHaveFocus();
    await userEvent.tab();
    expect(two).toHaveFocus();
    await userEvent.tab();
    expect(one).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(two).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('keeps focus on the panel when nothing inside can take it', async () => {
    render(
      <Sheet open label="안내" onClose={vi.fn()}>
        <p>글만 있어요</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    await userEvent.tab();
    expect(dialog).toHaveFocus();
  });

  /** Drags the dialog down by `to` px in small slow steps, then lets go. */
  async function drag(to: number, step = 20) {
    const dialog = screen.getByRole('dialog');
    fireEvent.pointerDown(dialog, { clientX: 100, clientY: 10, isPrimary: true, button: 0 });
    for (let y = step; y <= to; y += step) {
      await new Promise((r) => setTimeout(r, 16));
      fireEvent.pointerMove(window, { clientX: 100, clientY: 10 + y, isPrimary: true });
    }
    await new Promise((r) => setTimeout(r, 120));
    fireEvent.pointerUp(window, { clientX: 100, clientY: 10 + to, isPrimary: true });
  }

  it('closes when the panel is dragged down far enough', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="x" onClose={onClose}>
        <Body />
      </Sheet>,
    );
    await drag(CLOSE_OFFSET + 180);
    await vi.waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('stays open after a small slow drag', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="x" onClose={onClose}>
        <Body />
      </Sheet>,
    );
    await drag(30, 5);
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cannot be dragged closed under reduced motion', async () => {
    reduced.value = true;
    const onClose = vi.fn();
    render(
      <Sheet open label="x" onClose={onClose}>
        <Body />
      </Sheet>,
    );
    await drag(CLOSE_OFFSET + 180);
    await new Promise((r) => setTimeout(r, 50));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('matches tokens.json motion.sheet damping', () => {
    const tokens = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../../design/tokens.json'), 'utf8'),
    ) as { motion: { sheet: string } };
    expect(tokens.motion.sheet).toContain(`damping ${String(SHEET_SPRING.damping)}`);
  });

  it('closes on a drag down past the offset or a fast fling, not a small nudge', () => {
    const v = (y: number) => ({ x: 0, y });
    expect(shouldClose({ offset: v(CLOSE_OFFSET + 1), velocity: v(0) })).toBe(true);
    expect(shouldClose({ offset: v(10), velocity: v(CLOSE_VELOCITY + 1) })).toBe(true);
    expect(shouldClose({ offset: v(CLOSE_OFFSET), velocity: v(CLOSE_VELOCITY) })).toBe(false);
    expect(shouldClose({ offset: v(-300), velocity: v(-900) })).toBe(false);
  });

  it.each(['content', 'full'] as const)('puts only the %s snap class on the panel', (snap) => {
    render(
      <Sheet open label="x" onClose={vi.fn()} snap={snap}>
        <Body />
      </Sheet>,
    );
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain(styles[snap]);
    expect(cls).not.toContain(styles[snap === 'full' ? 'content' : 'full']);
  });

  it('only fades under reduced motion: no slide transform', async () => {
    reduced.value = true;
    render(
      <Sheet open label="x" onClose={vi.fn()}>
        <Body />
      </Sheet>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole('dialog').style.transform).not.toMatch(/translateY/);
  });

  it('slides up from below by default', () => {
    render(
      <Sheet open label="x" onClose={vi.fn()}>
        <Body />
      </Sheet>,
    );
    expect(screen.getByRole('dialog').style.transform).toMatch(/translateY\(100%\)/);
  });

  it('sends Escape no further than the sheet', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Sheet open label="x" onClose={vi.fn()}>
          <Body />
        </Sheet>
      </div>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(outer).not.toHaveBeenCalled();
  });

  // Confirm.dc.html 22-25.
  it('matches the design values', () => {
    expect(rule('.scrim')).toMatch(/background:\s*var\(--color-scrim\)/);
    const panel = rule('.panel');
    expect(panel).toMatch(/border-radius:\s*var\(--radius-sheet\) var\(--radius-sheet\) 0 0/);
    expect(panel).toMatch(/background:\s*var\(--color-surface\)/);
    expect(panel).toMatch(/padding:\s*var\(--size-sheet-top\) var\(--space-5\) var\(--space-7\)/);
    expect(panel).toMatch(/gap:\s*var\(--space-5\)/);
    const handle = rule('.handle');
    expect(handle).toMatch(/width:\s*var\(--size-sheet-handle-width\)/);
    expect(handle).toMatch(/height:\s*var\(--size-sheet-handle-height\)/);
    expect(handle).toMatch(/background:\s*var\(--color-line-strong\)/);
    expect(handle).toMatch(/border-radius:\s*var\(--radius-sheet-handle\)/);
    expect(handle).toMatch(/align-self:\s*center/);
    expect(rule('.body')).toMatch(/overflow-y:\s*auto/);
    expect(rule('.full')).toMatch(/height:\s*calc\(100% - var\(--size-top-bar\)\)/);
  });
});
