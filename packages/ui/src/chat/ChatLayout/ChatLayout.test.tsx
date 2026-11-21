import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatLayout } from './ChatLayout';
import styles from './ChatLayout.module.css';

const css = readFileSync(resolve(__dirname, 'ChatLayout.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('ChatLayout (ChatLayout.md 테스트 기준)', () => {
  it('stacks top row, budget, messages and input in that order', () => {
    const { container } = render(
      <ChatLayout header={<i>head</i>} top={<i>budget</i>} footer={<i>input</i>}>
        <i>thread</i>
      </ChatLayout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(Array.from(root.children).map((c) => c.textContent)).toEqual([
      'head',
      'budget',
      'thread',
      'input',
    ]);
    // The messages are not wrapped: ChatThread takes the free height itself.
    expect(root.children[2]?.tagName).toBe('I');
  });

  it('lifts the input band above the keyboard by the covered height (mock visualViewport)', () => {
    const listeners = new Set<() => void>();
    const vv = {
      height: window.innerHeight,
      offsetTop: 0,
      addEventListener: (_t: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_t: string, fn: () => void) => listeners.delete(fn),
    };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    const { container } = render(
      <ChatLayout footer={<i>input</i>}>
        <i>thread</i>
      </ChatLayout>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.paddingBottom).toBe('');
    act(() => {
      vv.height = window.innerHeight - 300;
      listeners.forEach((fn) => {
        fn();
      });
    });
    expect(root.style.paddingBottom).toBe('300px');
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  it.each([undefined, null])('draws no band for a missing header or top (%s)', (empty) => {
    const { container } = render(
      <ChatLayout header={empty} top={empty} footer={<i>input</i>}>
        <i>thread</i>
      </ChatLayout>,
    );
    expect(container.querySelector(`.${styles.header ?? 'header'}`)).toBeNull();
    expect(container.querySelector(`.${styles.top ?? 'top'}`)).toBeNull();
    expect((container.firstElementChild as HTMLElement).children).toHaveLength(2);
  });

  // Main.dc.html 22, 30, 88.
  it('matches the design bands', () => {
    expect(rule('.layout')).toMatch(/flex-grow:\s*1/);
    expect(rule('.layout')).toMatch(/min-height:\s*0/);
    expect(rule('.header')).toMatch(
      /padding:\s*var\(--space-4\) var\(--space-5\) var\(--space-3\)/,
    );
    expect(rule('.top')).toMatch(/padding:\s*0 var\(--space-5\)/);
    // Main.dc.html: the order card sits 10 under the budget card.
    expect(rule('.top')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.footer')).toMatch(
      /padding:\s*var\(--size-input-band-top\) var\(--space-4\) var\(--space-6\)/,
    );
    expect(rule('.footer')).toMatch(/background:\s*var\(--theme-bg\)/);
  });
});
