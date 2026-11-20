import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
const part = (svg: Element | null, name: string) =>
  svg?.querySelector(`[data-part="${name}"]`) ?? null;
const parts = (svg: Element | null) =>
  Array.from(svg?.querySelectorAll('[data-part]') ?? []).map((n) => n.getAttribute('data-part'));
const count = (el: Element | null, selector: string) => el?.querySelectorAll(selector).length ?? 0;

describe('Dragon (Dragon.md 테스트 기준)', () => {
  it('draws a different picture for every mood', () => {
    const pictures = MOODS.map(
      (mood) => svgOf(<Dragon mood={mood} size={96} species="forest" />)?.innerHTML,
    );
    expect(new Set(pictures).size).toBe(MOODS.length);
  });

  it.each([
    ['sleeping', ['eyes-closed', 'zz']],
    ['worried', ['brows', 'sweat', 'mouth-wavy']],
    ['cooking', ['mouth-o', 'steam']],
    ['eating', ['eyes-closed', 'bowl']],
    ['happy', ['eyes-arc', 'mouth-open']],
    ['excited', ['eyes-big', 'mouth-open']],
  ] as const)('%s has its design marks', (mood, marks) => {
    const found = parts(svgOf(<Dragon mood={mood} size={96} species="forest" />));
    for (const mark of marks) expect(found).toContain(mark);
  });

  // Blocked.dc.html: head circle at cy 40 r 15, eyes at cy 33 and brows above the shell rim.
  it('hiding sinks the head but keeps brows and eyes above the rim, with sweat', () => {
    const svg = svgOf(<Dragon mood="hiding" size={128} species="forest" />);
    const head = part(svg, 'head');
    expect(head?.getAttribute('cy')).toBe('40');
    expect(head?.getAttribute('r')).toBe('15');
    const eyes = Array.from(part(svg, 'eyes-peek')?.querySelectorAll('circle') ?? []);
    expect(eyes.map((e) => e.getAttribute('cy'))).toEqual(['33', '33']);
    expect(part(svg, 'brows')).not.toBeNull();
    expect(part(svg, 'sweat')).not.toBeNull();
    // the hiding rim starts at y 36 (its lowest teeth reach 32.5), drawn after the head
    expect(part(svg, 'shell-hiding')?.getAttribute('d')?.startsWith('M8 36')).toBe(true);
    expect(part(svg, 'shell')).toBeNull();
  });

  it('is decorative: hidden from screen readers and not focusable', () => {
    const svg = svgOf(<Dragon mood="default" size={44} species="water" />);
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  // D-20 and design/screens/Dragons.dc.html: species differ by head decoration, counted by element.
  it('forest: two leaf crests with veins, two shell leaves', () => {
    const svg = svgOf(<Dragon mood="default" size={96} species="forest" />);
    expect(count(part(svg, 'leaf-crest'), 'path')).toBe(3);
    expect(count(part(svg, 'shell-leaves'), 'path')).toBe(2);
  });

  it('water: two fin ears, a droplet on the forehead, one shell wave', () => {
    const svg = svgOf(<Dragon mood="default" size={96} species="water" />);
    expect(count(part(svg, 'fin-ears'), 'path')).toBe(2);
    expect(part(svg, 'droplet')?.tagName).toBe('path');
    expect(part(svg, 'shell-wave')?.tagName).toBe('path');
  });

  it('flower: two petal ears, a five-petal crest with a yolk center, bigger cheeks', () => {
    const svg = svgOf(<Dragon mood="default" size={96} species="flower" />);
    expect(count(part(svg, 'petal-ears'), 'circle')).toBe(2);
    expect(count(part(svg, 'flower-crest'), 'circle')).toBe(6);
    expect(count(part(svg, 'shell-petals'), 'circle')).toBe(5);
    expect(svg?.querySelector('ellipse')?.getAttribute('rx')).toBe('3.2');
  });

  it('star: a big horn and two small stars, a wink and a wider grin', () => {
    const svg = svgOf(<Dragon mood="default" size={96} species="star" />);
    expect(count(part(svg, 'star-horn'), 'path')).toBe(3);
    expect(part(svg, 'eyes-wink')).not.toBeNull();
    expect(part(svg, 'mouth-grin')?.getAttribute('d')).toBe('M29.5 34 Q32 37 34.5 34');
    expect(count(part(svg, 'shell-stars'), 'path')).toBe(1);
  });

  it('only the star winks, and only in its default face', () => {
    for (const species of DRAGON_SPECIES) {
      for (const mood of MOODS) {
        const winks =
          part(svgOf(<Dragon mood={mood} size={56} species={species} />), 'eyes-wink') !== null;
        expect(winks, `${species} ${mood}`).toBe(species === 'star' && mood === 'default');
      }
    }
  });

  it('draws wings only when asked, and the requested size', () => {
    expect(part(svgOf(<Dragon mood="happy" size={128} species="forest" />), 'wings')).toBeNull();
    const svg = svgOf(<Dragon mood="happy" size={128} species="forest" wings />);
    expect(count(part(svg, 'wings'), 'path')).toBe(2);
    expect(svg).toHaveAttribute('width', '128');
  });
});

describe('Dragon species colors (tokens.json dragonSpecies)', () => {
  const css = readFileSync(resolve(__dirname, 'Dragon.module.css'), 'utf8');
  const tokens = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../../design/tokens.json'), 'utf8'),
  ) as {
    dragonSpecies: Record<string, { color?: string }>;
  };

  it.each(DRAGON_SPECIES)('%s uses its dex color for body and accent', (species) => {
    const color = tokens.dragonSpecies[species]?.color ?? '';
    const block =
      species === 'forest'
        ? (/\.dragon\s*\{([^}]*)\}/.exec(css)?.[1] ?? '')
        : (new RegExp(`\\[data-species='${species}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '');
    expect(block).toContain(`--dragon-body: var(--color-dragon-${color});`);
    expect(block).toContain(`--dragon-accent: var(--color-dragon-accent-${color});`);
  });

  it.each([32, 44, 56, 64, 96, 128, 168] as const)(
    'draws at %spx (IdCard portrait is 64, Look and Splash 168)',
    (size) => {
      const svg = svgOf(<Dragon mood="default" size={size} species="forest" />);
      expect(svg?.getAttribute('width')).toBe(String(size));
      expect(svg?.getAttribute('height')).toBe(String(size));
    },
  );
});
