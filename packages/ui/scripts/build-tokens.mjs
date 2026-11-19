// Generates src/tokens/tokens.css from design/tokens.json (design/README.md: tokens.json
// is the source). Run `pnpm --filter @sikyeoyong/ui tokens` after editing tokens.json.
// tokens.test.ts fails if the committed CSS drifts from the JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, '../../../design/tokens.json');
const target = resolve(here, '../src/tokens/tokens.css');

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function fail(message) {
  throw new Error(`design/tokens.json: ${message}`);
}

export function renderTokens(tokens) {
  const lines = [];
  const add = (name, value) => lines.push(`  --${name}: ${value};`);
  for (const [key, value] of Object.entries(tokens.color)) {
    if (typeof value === 'string') {
      add(`color-${kebab(key)}`, value);
      continue;
    }
    if (value === null || typeof value !== 'object')
      fail(`color.${key} must be a string or an object`);
    for (const [sub, v] of Object.entries(value)) {
      if (typeof v !== 'string')
        fail(`color.${key}.${sub} must be a string (one level of nesting only)`);
      add(`color-${kebab(key)}-${kebab(sub)}`, v);
    }
  }
  for (const [key, t] of Object.entries(tokens.type)) {
    if (typeof t.size !== 'number') fail(`type.${key}.size must be a number`);
    add(`type-${kebab(key)}-size`, `${t.size}px`);
    if (t.weight !== undefined) add(`type-${kebab(key)}-weight`, String(t.weight));
    if (t.lineHeight !== undefined) add(`type-${kebab(key)}-line-height`, String(t.lineHeight));
    if (t.letterSpacing !== undefined) {
      if (t.letterSpacing !== 0 && typeof t.letterSpacing !== 'string') {
        fail(`type.${key}.letterSpacing must be 0 or a CSS length string`);
      }
      add(`type-${kebab(key)}-letter-spacing`, t.letterSpacing === 0 ? '0' : t.letterSpacing);
    }
  }
  tokens.space.forEach((v, i) => add(`space-${i + 1}`, `${v}px`));
  for (const [key, v] of Object.entries(tokens.radius)) add(`radius-${kebab(key)}`, `${v}px`);
  for (const [key, v] of Object.entries(tokens.size)) add(`size-${kebab(key)}`, `${v}px`);
  return [
    '/* Generated from design/tokens.json by scripts/build-tokens.mjs. Do not edit. */',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(readFileSync(source, 'utf8'));
  writeFileSync(target, renderTokens(tokens));
  console.warn(`tokens written: ${target}`);
}
