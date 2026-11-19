import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESS_SCALE, PRESS_SPRING } from './press';

const tokens = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../design/tokens.json'), 'utf8'),
) as { motion: { press: string } };

describe('press motion', () => {
  it('matches tokens.json motion.press', () => {
    const press = tokens.motion.press;
    expect(press).toContain(`scale ${String(PRESS_SCALE)}`);
    expect(press).toContain(`damping ${String(PRESS_SPRING.damping)}`);
    expect(press).toContain(`stiffness ${String(PRESS_SPRING.stiffness)}`);
  });

  it.each(['Button/Button.tsx', 'Chip/Chip.tsx', 'Switch/Switch.tsx'])(
    '%s uses the shared spring, not its own numbers',
    (file) => {
      const src = readFileSync(resolve(__dirname, file), 'utf8');
      expect(src).toContain('PRESS_SPRING');
      expect(src).not.toMatch(/damping:\s*\d/);
      expect(src).not.toMatch(/stiffness:\s*\d/);
    },
  );

  it('is the only press target: no component builds its own pressed button', () => {
    // D-18 principle 5: buttons are base Button or Chip (Switch presses its knob).
    const src = resolve(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.(test|stories)\./.test(e.name)) files.push(p);
      }
    };
    walk(src);
    const own = new Set([
      'base/press.ts',
      'base/Button/Button.tsx',
      'base/Chip/Chip.tsx',
      'base/Switch/Switch.tsx',
    ]);
    for (const f of files) {
      const rel = relative(src, f);
      if (own.has(rel)) continue;
      const text = readFileSync(f, 'utf8');
      expect(text, rel).not.toMatch(/motion\.button/);
      expect(text, rel).not.toMatch(/PRESS_SCALE/);
    }
    for (const f of ['Button/Button.tsx', 'Chip/Chip.tsx']) {
      expect(readFileSync(resolve(__dirname, f), 'utf8')).not.toMatch(/scale:\s*PRESS_SCALE/);
    }
  });
});
