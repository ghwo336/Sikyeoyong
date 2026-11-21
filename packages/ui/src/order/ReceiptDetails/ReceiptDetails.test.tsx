import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ReceiptDetails, type ReceiptDetailsProps, shortHash } from './ReceiptDetails';

const css = readFileSync(resolve(__dirname, 'ReceiptDetails.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:[\]]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

const HASH = '0x8f3a5b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7ec21e';
const base: ReceiptDetailsProps = {
  txHash: HASH,
  agentId: '1042',
  rules: ['AGENT_OKRW_TRANSFER_LIMIT_POLICY', 'PERIODIC_VOLUME_POLICY'],
  explorerUrl: 'https://example.invalid/tx/0x8f3a',
};
const toggle = () => screen.getByRole('button', { name: '자세히 보기' });

describe('ReceiptDetails (ReceiptDetails.md 테스트 기준)', () => {
  it('opens and closes with aria-expanded tied to the panel', async () => {
    render(<ReceiptDetails {...base} />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('결제 기록 번호')).toBeNull();
    await userEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(toggle().getAttribute('aria-controls') ?? '');
    expect(panel).toContainElement(screen.getByText('결제 기록 번호'));
    await userEvent.click(toggle());
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('결제 기록 번호')).toBeNull();
  });

  it('shows nothing but the toggle while closed, before and after opening (D-17)', async () => {
    const { container } = render(<ReceiptDetails {...base} />);
    const closed = () => {
      // Chain words, rule names, the record number and the link live only inside.
      expect(container.firstElementChild?.textContent).toBe('자세히 보기');
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByRole('list')).toBeNull();
    };
    closed();
    await userEvent.click(toggle());
    expect(screen.getByRole('link')).toBeInTheDocument();
    await userEvent.click(toggle());
    closed();
  });

  it('points aria-controls at the panel only while it exists', async () => {
    render(<ReceiptDetails {...base} />);
    expect(toggle()).not.toHaveAttribute('aria-controls');
    await userEvent.click(toggle());
    expect(document.getElementById(toggle().getAttribute('aria-controls') ?? '')).not.toBeNull();
  });

  it('links only to https explorer addresses', () => {
    const { rerender } = render(<ReceiptDetails {...base} defaultOpen />);
    expect(screen.getByRole('link')).toBeInTheDocument();
    rerender(<ReceiptDetails {...base} explorerUrl="javascript:alert(1)" defaultOpen />);
    expect(screen.queryByRole('link')).toBeNull();
    rerender(<ReceiptDetails {...base} explorerUrl="http://example.invalid/tx" defaultOpen />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens with the keyboard too', async () => {
    render(<ReceiptDetails {...base} />);
    toggle().focus();
    await userEvent.keyboard('{Enter}');
    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows exactly the rules the server receipt gave, in order, with the count', () => {
    render(<ReceiptDetails {...base} defaultOpen />);
    expect(screen.getByText('통과한 마루 규칙 2개')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      'AGENT_OKRW_TRANSFER_LIMIT_POLICY',
      'PERIODIC_VOLUME_POLICY',
    ]);
  });

  it('has no rules block when no rule ran (path C)', () => {
    render(<ReceiptDetails {...base} rules={[]} defaultOpen />);
    expect(screen.queryByText(/통과한 마루 규칙/)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('결제 기록 번호')).toBeInTheDocument();
  });

  it('shortens the record number, keeping the full one on hover', () => {
    render(<ReceiptDetails {...base} defaultOpen />);
    const short = screen.getByText('0x8f3a…c21e');
    expect(short).toHaveAttribute('title', HASH);
    expect(shortHash('0x12')).toBe('0x12');
    expect(shortHash('0x1234567890')).toBe('0x1234567890'); // 12 characters stay
    expect(shortHash('0x12345678901')).toBe('0x1234…8901'); // 13 are shortened
  });

  it('shows the ID card number and a safe link to the explorer', () => {
    render(<ReceiptDetails {...base} defaultOpen />);
    expect(screen.getByText('1042')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '마루 탐색기에서 보기' });
    expect(link).toHaveAttribute('href', base.explorerUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // Receipt.dc.html 37-48.
  it('matches the design values', () => {
    expect(rule('.card')).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(rule('.card')).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(rule('.toggle')).toMatch(/min-height:\s*var\(--size-details-toggle\)/);
    expect(rule('.toggle')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.chevron')).toMatch(/width:\s*var\(--size-details-icon\)/);
    expect(rule('.chevron[data-open]')).toMatch(/rotate:\s*180deg/);
    expect(css).toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.chevron\s*\{\s*transition:\s*none/,
    );
    expect(rule('.panel')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.panel')).toMatch(/padding:\s*0 var\(--space-4\) var\(--space-4\)/);
    expect(rule('.code')).toMatch(/font-family:\s*var\(--font-code\)/);
    expect(rule('.ruleList')).toMatch(/font-size:\s*var\(--type-code-size\)/);
    expect(rule('.ruleList')).toMatch(/color:\s*var\(--color-ink-code\)/);
    expect(rule('.link')).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(rule('.link')).toMatch(/color:\s*var\(--theme-accent\)/);
  });

  it('draws no link when there is no explorer URL (a chain without one)', () => {
    const { explorerUrl: _omit, ...rest } = base;
    render(<ReceiptDetails {...rest} defaultOpen />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/0x8f3a/)).toBeInTheDocument();
  });
});
