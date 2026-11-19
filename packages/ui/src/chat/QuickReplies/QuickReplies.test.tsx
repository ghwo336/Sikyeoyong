import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickReplies } from './QuickReplies';

const css = readFileSync(resolve(__dirname, 'QuickReplies.module.css'), 'utf8');
const ITEMS = [
  { id: 'pick', label: '돼지국밥으로' },
  { id: 'cheaper', label: '더 싼 거 없어?' },
];

describe('QuickReplies (QuickReplies.md 테스트 기준)', () => {
  it('hands the picked id to onPick', async () => {
    const onPick = vi.fn();
    render(<QuickReplies items={ITEMS} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: '더 싼 거 없어?' }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('cheaper');
    await userEvent.click(screen.getByRole('button', { name: '돼지국밥으로' }));
    expect(onPick).toHaveBeenLastCalledWith('pick');
  });

  it('draws one plain chip button per item, in order, inside a named group', () => {
    render(<QuickReplies items={ITEMS} onPick={vi.fn()} />);
    const group = screen.getByRole('group', { name: '빠른 답장' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['돼지국밥으로', '더 싼 거 없어?']);
    for (const b of buttons) {
      expect(group).toContainElement(b);
      expect(b).not.toHaveAttribute('aria-checked');
    }
  });

  it('draws nothing for no items', () => {
    const { container } = render(<QuickReplies items={[]} onPick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  // Main.dc.html line 77.
  it('wraps, 8 apart, lined up with the dragon text', () => {
    expect(css).toMatch(/flex-wrap:\s*wrap/);
    expect(css).toMatch(/gap:\s*var\(--space-2\)/);
    expect(css).toMatch(
      /padding-left:\s*calc\(var\(--size-dragon-chat\) \+ var\(--size-dragon-chat-gap\)\)/,
    );
  });
});
