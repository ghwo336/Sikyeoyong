import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon, type IconName } from './Icon';

const NAMES: readonly IconName[] = [
  'back',
  'chevron-right',
  'chevron-down',
  'arrow-right',
  'arrow-up',
  'face-id',
  'kakao',
  'more',
];

describe('Icon (Icon.md 테스트 기준)', () => {
  it.each(NAMES)('%s is hidden from screen readers and drawn in currentColor', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('data-icon', name);
    const color = svg?.getAttribute('stroke') ?? svg?.getAttribute('fill');
    expect(color).toBe('currentColor');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  // Stroke widths and paths as drawn in the design files.
  it.each([
    ['back', '2', ['M15 5l-7 7 7 7']],
    ['chevron-right', '2', ['M9 6l6 6-6 6']],
    ['chevron-down', '2', ['M6 9l6 6 6-6']],
    ['arrow-right', '2', ['M5 12h14', 'M13 6l6 6-6 6']],
    ['arrow-up', '2.2', ['M12 19V5', 'M6 11l6-6 6 6']],
  ] as const)('%s matches the design line (stroke %s)', (name, stroke, paths) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke-width', stroke);
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke-linejoin', 'round');
    expect(Array.from(svg?.querySelectorAll('path') ?? []).map((p) => p.getAttribute('d'))).toEqual(
      paths,
    );
  });

  it('draws face-id as a 1.8 line without round joins (LimitChat.dc.html)', () => {
    const { container } = render(<Icon name="face-id" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke-width', '1.8');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(svg).not.toHaveAttribute('stroke-linejoin');
  });

  it('draws more as three dots on a 1.8 line without round joins (Main.dc.html)', () => {
    const { container } = render(<Icon name="more" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('stroke-width', '1.8');
    expect(svg).toHaveAttribute('stroke-linecap', 'round');
    expect(svg).not.toHaveAttribute('stroke-linejoin');
    expect(svg?.querySelectorAll('path')).toHaveLength(3);
  });

  it('fills the kakao mark instead of stroking it', () => {
    const { container } = render(<Icon name="kakao" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('fill', 'currentColor');
    expect(svg).not.toHaveAttribute('stroke');
  });

  it("keeps the caller's class and data attributes for size and state", () => {
    const { container } = render(<Icon name="chevron-down" className="chevron" data-open />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('chevron');
    expect(svg).toHaveClass('glyph');
    expect(svg).toHaveAttribute('data-open', 'true');
  });

  it('is the only place that draws a one-color icon (D-18 principle 5)', () => {
    // Pictures and multi-color marks keep their own svg: the dragon, the egg, the map,
    // the hatch status marks (per-part colors and a spinning arc), Google's four-color G and the
    // splash's white edge around the dragon (a picture, not an icon).
    const own = new Set([
      'base/Icon/Icon.tsx',
      'dragon/Dragon/Dragon.tsx',
      'dragon/Egg/Egg.tsx',
      'order/DeliveryMap/DeliveryMap.tsx',
      'onboarding/HatchProgress/HatchProgress.tsx',
      'onboarding/SocialLogin/SocialLogin.tsx',
      'onboarding/Splash/Splash.tsx',
    ]);
    const src = resolve(__dirname, '../..');
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.tsx') && !/\.(test|stories)\./.test(e.name)) {
          if (readFileSync(p, 'utf8').includes('<svg')) found.push(relative(src, p));
        }
      }
    };
    walk(src);
    for (const f of found) expect(own.has(f), f).toBe(true);
    // SocialLogin keeps only the Google G; its Kakao mark is the shared icon.
    const social = readFileSync(resolve(src, 'onboarding/SocialLogin/SocialLogin.tsx'), 'utf8');
    expect(social.match(/<svg/g)).toHaveLength(1);
  });
});
