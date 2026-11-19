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

export function renderTokens(tokens) {
  const lines = [];
  const add = (name, value) => lines.push(`  --${name}: ${value};`);
  for (const [key, value] of Object.entries(tokens.color)) {
    if (typeof value === 'string') add(`color-${kebab(key)}`, value);
    else for (const [sub, v] of Object.entries(value)) add(`color-${kebab(key)}-${kebab(sub)}`, v);
  }
  for (const [key, t] of Object.entries(tokens.type)) {
    add(`type-${key}-size`, `${t.size}px`);
    if (t.weight !== undefined) add(`type-${key}-weight`, String(t.weight));
    if (t.lineHeight !== undefined) add(`type-${key}-line-height`, String(t.lineHeight));
    if (t.letterSpacing !== undefined)
      add(`type-${key}-letter-spacing`, t.letterSpacing === 0 ? '0' : t.letterSpacing);
  }
  tokens.space.forEach((v, i) => add(`space-${i + 1}`, `${v}px`));
  for (const [key, v] of Object.entries(tokens.radius)) add(`radius-${kebab(key)}`, `${v}px`);
  for (const [key, v] of Object.entries(tokens.size)) add(`size-${kebab(key)}`, `${v}px`);
  add('font-ui', "'Pretendard Variable', Pretendard, system-ui, sans-serif");
  add('font-dragon', "'Gowun Dodum', 'Pretendard Variable', sans-serif");
  add('font-code', 'ui-monospace, SFMono-Regular, Menlo, monospace');
  add('motion-screen', '220ms');
  add('motion-number', '400ms');
  add('ease-out', 'cubic-bezier(0.22, 1, 0.36, 1)');
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
