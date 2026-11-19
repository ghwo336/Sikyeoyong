import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { ActionPair } from './ActionPair';

const css = readFileSync(resolve(__dirname, 'ActionPair.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('ActionPair (ActionPair.md 테스트 기준)', () => {
  it('puts the main action first, then the way out', async () => {
    const onMain = vi.fn();
    const onOut = vi.fn();
    render(
      <ActionPair
        gap="xs"
        primary={
          <Button variant="primary" onPress={onMain}>
            시키기
          </Button>
        }
        secondary={
          <Button variant="text" onPress={onOut}>
            다시 고를래
          </Button>
        }
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['시키기', '다시 고를래']);
    await userEvent.click(buttons[1] as HTMLElement);
    expect(onOut).toHaveBeenCalledTimes(1);
    expect(onMain).not.toHaveBeenCalled();
  });

  it('draws only the way out when there is no main action', () => {
    render(
      <ActionPair
        gap="md"
        secondary={
          <Button variant="secondary" onPress={() => undefined}>
            다시 고르기
          </Button>
        }
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it.each(['xs', 'sm', 'md'] as const)('puts the %s gap class on the stack', (gap) => {
    const { container } = render(<ActionPair gap={gap} secondary={<span />} />);
    expect(container.firstElementChild?.classList).toContain(gap);
  });

  // Confirm 4, LimitChat 6, Cap and Blocked 8.
  it('matches the design values', () => {
    expect(rule('.pair')).toMatch(/flex-direction:\s*column/);
    expect(rule('.xs')).toMatch(/gap:\s*var\(--space-1\)/);
    expect(rule('.sm')).toMatch(/gap:\s*6px/);
    expect(rule('.md')).toMatch(/gap:\s*var\(--space-2\)/);
  });
});
