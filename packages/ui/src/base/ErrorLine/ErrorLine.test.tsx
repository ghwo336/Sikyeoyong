import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorLine } from './ErrorLine';

const css = readFileSync(resolve(__dirname, 'ErrorLine.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

describe('ErrorLine (ErrorLine.md 테스트 기준)', () => {
  it('is announced as an alert with the given words', () => {
    render(<ErrorLine>못 바꿨어요. 다시 해 볼까요?</ErrorLine>);
    expect(screen.getByRole('alert')).toHaveTextContent('못 바꿨어요. 다시 해 볼까요?');
  });

  it('carries the id an input points at', () => {
    render(<ErrorLine id="name-error">이름을 지어 주세요</ErrorLine>);
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'name-error');
  });

  it('starts at the left by default and can center', () => {
    const { rerender } = render(<ErrorLine>x</ErrorLine>);
    expect(screen.getByRole('alert')).toHaveAttribute('data-align', 'start');
    rerender(<ErrorLine align="center">x</ErrorLine>);
    expect(screen.getByRole('alert')).toHaveAttribute('data-align', 'center');
  });

  it('matches the caution look (13px over-ink, no margin)', () => {
    const line = rule('.line');
    expect(line).toMatch(/margin:\s*0/);
    expect(line).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(line).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(rule(".line[data-align='center']")).toMatch(/text-align:\s*center/);
  });
});
