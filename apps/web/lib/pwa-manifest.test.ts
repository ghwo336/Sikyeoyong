import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from '../../../design/tokens.json';

// public/manifest.webmanifest is static JSON (app/ holds only pages and layouts, D-18), so its
// colors are copied from design/tokens.json by hand. This keeps the copy honest.
describe('manifest.webmanifest', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/manifest.webmanifest'), 'utf8'),
  ) as Record<string, unknown>;

  it('opens standalone (no browser bar) and uses the ground color from tokens.json', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe(tokens.color.ground);
    expect(manifest.theme_color).toBe(tokens.color.ground);
  });
});
