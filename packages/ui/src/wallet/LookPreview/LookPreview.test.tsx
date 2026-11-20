import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SPECIES_INFO } from '../../dragon/Dragon';
import { LookPreview } from './LookPreview';

const css = readFileSync(resolve(__dirname, 'LookPreview.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('LookPreview (LookPreview.md 테스트 기준)', () => {
  it.each([...DRAGON_SPECIES])(
    '%s: the dragon in that species at 168, the name, the species and its line',
    (species) => {
      const { container } = render(<LookPreview name="용이" species={species} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('data-species', species);
      expect(svg).toHaveAttribute('width', '168');
      expect(screen.getByText('용이')).toBeInTheDocument();
      expect(screen.getByText(SPECIES_INFO[species].name)).toBeInTheDocument();
      expect(screen.getByText(`"${SPECIES_INFO[species].line}"`)).toBeInTheDocument();
    },
  );

  it('reads out a new pick (polite live region), the dragon itself is decoration', () => {
    const { container } = render(<LookPreview name="용이" species="water" />);
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'polite');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the theme colors for the block and the badge (D-32), the Look design values', () => {
    expect(rule('.preview')).toMatch(/background:\s*var\(--theme-tint\)/);
    expect(rule('.preview')).toMatch(/border-radius:\s*var\(--radius-sheet\)/);
    expect(rule('.preview')).toMatch(/padding:\s*var\(--space-6\) var\(--space-5\) 22px/);
    expect(rule('.badge')).toMatch(/background:\s*var\(--theme-accent\)/);
    expect(rule('.badge')).toMatch(/color:\s*var\(--color-surface\)/);
    expect(rule('.line')).toMatch(/font-family:\s*var\(--font-dragon\)/);
  });
});
