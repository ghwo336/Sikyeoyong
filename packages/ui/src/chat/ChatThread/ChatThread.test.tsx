import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatThread, isNearBottom, PIN_SLACK } from './ChatThread';

const css = readFileSync(resolve(__dirname, 'ChatThread.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

/** jsdom has no layout: give the log fake sizes. scrollHeight grows with the message count. */
function fakeLayout(el: HTMLElement, clientHeight = 400) {
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => el.children.length * 100,
  });
}

function Thread({ count, autoScroll }: { count: number; autoScroll?: boolean }) {
  return (
    <ChatThread autoScroll={autoScroll}>
      {Array.from({ length: count }, (_, i) => (
        <p key={i}>메시지 {i}</p>
      ))}
    </ChatThread>
  );
}

describe('ChatThread (ChatThread.md 테스트 기준)', () => {
  it('scrolls to a new message at the bottom', () => {
    const { rerender } = render(<Thread count={3} />);
    const log = screen.getByRole('log');
    fakeLayout(log);
    rerender(<Thread count={10} />);
    expect(log.scrollTop).toBe(1000);
    rerender(<Thread count={12} />);
    expect(log.scrollTop).toBe(1200);
  });

  it('stops following once the user scrolls up, and follows again back at the bottom', () => {
    const { rerender } = render(<Thread count={10} />);
    const log = screen.getByRole('log');
    fakeLayout(log);
    rerender(<Thread count={10} />);
    log.scrollTop = 200; // far from the bottom (1000 - 200 - 400 = 400)
    fireEvent.scroll(log);
    rerender(<Thread count={11} />);
    expect(log.scrollTop).toBe(200);
    log.scrollTop = 1100 - 400 - PIN_SLACK; // back within the slack
    fireEvent.scroll(log);
    rerender(<Thread count={12} />);
    expect(log.scrollTop).toBe(1200);
  });

  it('follows streamed text that grows the last message', () => {
    function Stream({ text }: { text: string }) {
      return (
        <ChatThread streaming>
          <p>질문</p>
          <p>{text}</p>
        </ChatThread>
      );
    }
    const { rerender } = render(<Stream text="비" />);
    const log = screen.getByRole('log');
    let height = 500;
    Object.defineProperty(log, 'clientHeight', { configurable: true, get: () => 400 });
    Object.defineProperty(log, 'scrollHeight', { configurable: true, get: () => height });
    height = 640;
    rerender(<Stream text="비 오니까" />);
    expect(log.scrollTop).toBe(640);
    expect(log).toHaveAttribute('aria-busy', 'true');
  });

  it('does not scroll at all with autoScroll off', () => {
    const { rerender } = render(<Thread count={3} autoScroll={false} />);
    const log = screen.getByRole('log');
    fakeLayout(log);
    rerender(<Thread count={10} autoScroll={false} />);
    expect(log.scrollTop).toBe(0);
  });

  it('is a polite live log, busy only while streaming', () => {
    render(<Thread count={1} />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).not.toHaveAttribute('aria-busy');
  });

  it('shows the time stamp first when given', () => {
    render(
      <ChatThread stamp="오늘 오후 12:28">
        <p>메시지</p>
      </ChatThread>,
    );
    expect(screen.getByRole('log').firstElementChild?.textContent).toBe('오늘 오후 12:28');
  });

  it('counts within the slack as the bottom', () => {
    expect(isNearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 })).toBe(true);
    expect(
      isNearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - PIN_SLACK }),
    ).toBe(true);
    expect(
      isNearBottom({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - PIN_SLACK - 1 }),
    ).toBe(false);
  });

  // Main.dc.html 38-39.
  it('matches the design values', () => {
    const t = rule('.thread');
    expect(t).toMatch(/gap:\s*var\(--space-4\)/);
    expect(t).toMatch(/padding:\s*var\(--space-5\) var\(--space-5\) var\(--space-3\)/);
    expect(t).toMatch(/overflow-y:\s*auto/);
    expect(t).toMatch(/min-height:\s*0/);
    expect(rule('.stamp')).toMatch(/font-size:\s*var\(--type-stamp-size\)/);
    expect(rule('.stamp')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.stamp')).toMatch(/align-self:\s*center/);
  });

  it('never shrinks a message to fit the scrolling thread (a card would be cut)', () => {
    expect(css).toMatch(/\.thread > \* \{\s*flex-shrink: 0;\s*\}/);
  });

  it('scrolls without a scrollbar at the side, like an app (D-23)', () => {
    expect(rule('.thread')).toMatch(/scrollbar-width:\s*none/);
    expect(css).toMatch(/\.thread::-webkit-scrollbar\s*\{\s*display:\s*none;/);
  });
});
