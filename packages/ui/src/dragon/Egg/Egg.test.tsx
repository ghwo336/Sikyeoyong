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

  it('shows the two-stroke Zz only when sleeping (Frozen.dc.html)', () => {
    const zz = svgOf(<Egg state="sleeping" species="water" size={168} />)?.querySelector(
      '[data-part="zz"]',
    );
    expect(zz?.querySelectorAll('path')).toHaveLength(2);
    expect(parts(svgOf(<Egg state="closed" species="water" size={168} />))).not.toContain('zz');
  });

  // design/screens/Dragons.dc.html, counted by element.
  const pattern = (species: 'forest' | 'water' | 'flower' | 'star') => {
    const svg = svgOf(<Egg state="closed" species={species} size={120} />);
    return svg?.querySelector(`[data-part^="egg-"]`) ?? null;
  };

  it('forest: four leaf dots', () => {
    expect(pattern('forest')?.querySelectorAll('path')).toHaveLength(4);
  });

  it('water: two wave lines', () => {
    const waves = pattern('water');
    expect(waves?.getAttribute('data-part')).toBe('egg-waves');
    expect(waves?.querySelectorAll('path')).toHaveLength(2);
    expect(waves?.querySelectorAll('circle')).toHaveLength(0);
  });

  it('flower: ten petal dots and two yolk centers', () => {
    const petals = pattern('flower');
    expect(petals?.querySelectorAll('circle')).toHaveLength(12);
    expect(petals?.querySelectorAll('circle[r="1"]')).toHaveLength(2);
  });

  it('star: two stars, two dots and a moon', () => {
    const stars = pattern('star');
    expect(stars?.querySelectorAll('path:not([data-part])')).toHaveLength(2);
    expect(stars?.querySelectorAll('circle')).toHaveLength(2);
    expect(stars?.querySelectorAll('[data-part="egg-moon"]')).toHaveLength(1);
  });

  it('keeps the pattern inside the wobbling group with the shell', () => {
    const svg = svgOf(<Egg state="wobble" species="forest" size={120} />);
    const shell = svg?.querySelector('path[d^="M32 6"]');
    const leaves = svg?.querySelector('[data-part="egg-leaves"]');
    expect(shell?.parentElement).toBe(leaves?.parentElement);
    expect(shell?.parentElement).not.toBe(svg);
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
