import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
});
