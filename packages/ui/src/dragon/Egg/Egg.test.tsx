import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Egg } from './Egg';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('../../base/reduced-motion', () => ({ useShouldReduceMotion: () => reduced.value }));

afterEach(() => {
  reduced.value = false;
});

const svgOf = (ui: React.ReactElement) => render(ui).container.querySelector('svg');
const parts = (svg: Element | null) =>
  Array.from(svg?.querySelectorAll('[data-part]') ?? []).map((n) => n.getAttribute('data-part'));

describe('Egg (Egg.md 테스트 기준)', () => {
  it('wobbles only in the wobble state', () => {
    expect(svgOf(<Egg state="wobble" species="forest" size={120} />)).toHaveAttribute(
      'data-wobbling',
      'true',
    );
    expect(svgOf(<Egg state="closed" species="forest" size={120} />)).not.toHaveAttribute(
      'data-wobbling',
    );
  });

  it('does not wobble under reduced motion', () => {
    reduced.value = true;
    const svg = svgOf(<Egg state="wobble" species="forest" size={120} />);
    expect(svg).not.toHaveAttribute('data-wobbling');
    expect(svg).toHaveAttribute('data-state', 'wobble');
  });

  it('shows Zz only when sleeping', () => {
    expect(parts(svgOf(<Egg state="sleeping" species="water" size={168} />))).toContain('zz');
    expect(parts(svgOf(<Egg state="closed" species="water" size={168} />))).not.toContain('zz');
  });

  // design/screens/Dragons.dc.html: leaf dots, waves, petal dots, stars and moon.
  it.each([
    ['forest', 'egg-leaves'],
    ['water', 'egg-waves'],
    ['flower', 'egg-petals'],
    ['star', 'egg-moon'],
  ] as const)('%s egg has its own pattern', (species, mark) => {
    expect(parts(svgOf(<Egg state="closed" species={species} size={120} />))).toContain(mark);
  });

  it('draws a different egg for every species', () => {
    const pictures = DRAGON_SPECIES.map(
      (s) => svgOf(<Egg state="closed" species={s} size={120} />)?.innerHTML,
    );
    expect(new Set(pictures).size).toBe(4);
  });

  it('is decorative and sized', () => {
    const svg = svgOf(<Egg state="closed" species="star" size={56} />);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '56');
  });
});
