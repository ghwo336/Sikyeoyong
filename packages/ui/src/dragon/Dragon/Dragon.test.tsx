import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dragon, type DragonMood } from './Dragon';

const MOODS: DragonMood[] = [
  'default',
  'happy',
  'excited',
  'worried',
  'hiding',
  'sleeping',
  'eating',
  'cooking',
];

const svgOf = (ui: React.ReactElement) => render(ui).container.querySelector('svg');
const parts = (svg: Element | null) =>
  Array.from(svg?.querySelectorAll('[data-part]') ?? []).map((n) => n.getAttribute('data-part'));

describe('Dragon (Dragon.md 테스트 기준)', () => {
  it('draws a different picture for every mood', () => {
    const pictures = MOODS.map(
      (mood) => svgOf(<Dragon mood={mood} size={96} species="forest" />)?.innerHTML,
    );
    expect(new Set(pictures).size).toBe(MOODS.length);
  });

  it.each([
    ['sleeping', ['eyes-closed', 'zz']],
    ['worried', ['brows', 'sweat']],
    ['hiding', ['head-lowered', 'brows']],
    ['cooking', ['mouth-o', 'steam']],
    ['eating', ['eyes-closed', 'bowl']],
    ['happy', ['eyes-arc', 'mouth-open']],
    ['excited', ['eyes-big', 'mouth-open']],
  ] as const)('%s has its design marks', (mood, marks) => {
    const found = parts(svgOf(<Dragon mood={mood} size={96} species="forest" />));
    for (const mark of marks) expect(found).toContain(mark);
  });

  it('is decorative: hidden from screen readers and not focusable', () => {
    const svg = svgOf(<Dragon mood="default" size={44} species="water" />);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  // D-20 and design/screens/Dragons.dc.html: species differ by head decoration, not only color.
  it.each([
    ['forest', ['leaf-crest', 'shell-leaves']],
    ['water', ['fin-ears', 'droplet', 'shell-wave']],
    ['flower', ['petal-ears', 'flower-crest', 'shell-petals']],
    ['star', ['star-horn', 'eyes-wink', 'shell-stars']],
  ] as const)('%s has its own head decoration', (species, marks) => {
    const found = parts(svgOf(<Dragon mood="default" size={96} species={species} />));
    for (const mark of marks) expect(found).toContain(mark);
  });

  it('draws a different picture for every species', () => {
    const pictures = DRAGON_SPECIES.map(
      (s) => svgOf(<Dragon mood="default" size={96} species={s} />)?.innerHTML,
    );
    expect(new Set(pictures).size).toBe(DRAGON_SPECIES.length);
  });

  it('only the star winks, and only in the default mood', () => {
    expect(parts(svgOf(<Dragon mood="default" size={96} species="forest" />))).not.toContain(
      'eyes-wink',
    );
    expect(parts(svgOf(<Dragon mood="happy" size={96} species="star" />))).not.toContain(
      'eyes-wink',
    );
  });

  it('draws wings only when asked, and the requested size', () => {
    expect(parts(svgOf(<Dragon mood="happy" size={128} species="forest" />))).not.toContain(
      'wings',
    );
    const svg = svgOf(<Dragon mood="happy" size={128} species="forest" wings />);
    expect(parts(svg)).toContain('wings');
    expect(svg).toHaveAttribute('width', '128');
    expect(svg).toHaveAttribute('data-species', 'forest');
  });
});
