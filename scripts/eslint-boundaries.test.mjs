// Regression test for the import boundaries in eslint.config.mjs.
// Lints virtual files at real-looking paths and checks which rules fire.
// Run: node scripts/eslint-boundaries.test.mjs (part of `pnpm lint`).
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

const eslint = new ESLint({
  cwd: new URL('..', import.meta.url).pathname,
  overrideConfig: [
    { ...tseslint.configs.disableTypeChecked, files: ['**/*.{ts,tsx}'] },
    { files: ['**/*.{ts,tsx}'], languageOptions: { parserOptions: { projectService: false } } },
  ],
});

const IMPORTS = 'no-restricted-imports';
const cases = [
  // [path, code, rule that must fire or null for "must be clean"]
  ['packages/shared/src/a.ts', "import fs from 'fs';\nexport const a = fs;", IMPORTS],
  [
    'packages/shared/src/a.ts',
    "import { join } from 'node:path';\nexport const a = join;",
    IMPORTS,
  ],
  ['packages/shared/src/a.ts', "import React from 'react';\nexport const a = React;", IMPORTS],
  [
    'packages/shared/src/a.ts',
    "import { createPublicClient } from 'viem';\nexport const a = createPublicClient;",
    IMPORTS,
  ],
  [
    'packages/shared/src/a.ts',
    "import type { Address } from 'viem';\nexport type A = Address;",
    null,
  ],
  ['packages/shared/src/a.ts', 'export const a = process.env.A;', 'no-restricted-properties'],
  ['packages/shared/src/a.ts', "export const a = fetch('/x');", 'no-restricted-globals'],
  ['packages/shared/src/a.ts', "export const a = parseFloat('1');", 'no-restricted-globals'],
  ['packages/shared/src/a.ts', "import { z } from 'zod';\nexport const a = z.string();", null],
  [
    'packages/ui/src/base/X/X.tsx',
    "import { useQuery } from '@tanstack/react-query';\nexport const a = useQuery;",
    IMPORTS,
  ],
  [
    'packages/ui/src/base/X/X.tsx',
    "import { useRouter } from 'next/navigation';\nexport const a = useRouter;",
    IMPORTS,
  ],
  [
    'packages/ui/src/order/X/X.tsx',
    "import { L } from '../../limits/L/L';\nexport const a = L;",
    IMPORTS,
  ],
  [
    'packages/ui/src/order/X/X.tsx',
    "import { B } from '../../base/Button/Button';\nexport const a = B;",
    null,
  ],
  [
    'packages/ui/src/order/X/X.tsx',
    "import { D } from '../../dragon/Dragon/Dragon';\nexport const a = D;",
    null,
  ],
  [
    'packages/ui/src/order/X/X.tsx',
    "import { a as b } from '../../../../../apps/web/lib/x';\nexport const a = b;",
    IMPORTS,
  ],
  ['packages/ui/src/base/X/X.tsx', "export const a = fetch('/x');", 'no-restricted-globals'],
  [
    'apps/web/app/page.tsx',
    "import { createPublicClient } from 'viem';\nexport const a = createPublicClient;",
    IMPORTS,
  ],
  ['apps/web/app/page.tsx', "import A from '@anthropic-ai/sdk';\nexport const a = A;", IMPORTS],
  [
    'apps/web/app/page.tsx',
    "import { x } from '../../api/src/modules/payment/x';\nexport const a = x;",
    IMPORTS,
  ],
  [
    'apps/api/src/modules/orders/orders.service.ts',
    "import { R } from '../budget/budget.repository';\nexport const a = R;",
    IMPORTS,
  ],
  [
    'apps/api/src/modules/orders/orders.service.ts',
    "import { S } from '../budget/budget.service';\nexport const a = S;",
    null,
  ],
  [
    'apps/api/src/modules/orders/orders.service.ts',
    "import { db } from '../../db/client';\nexport const a = db;",
    IMPORTS,
  ],
  [
    'apps/api/src/modules/orders/orders.repository.ts',
    "import { db } from '../../db/client';\nexport const a = db;",
    null,
  ],
  [
    'apps/api/src/modules/orders/orders.module.ts',
    "import { DbModule } from '../../db/db.module';\nexport const a = DbModule;",
    null,
  ],
  [
    'apps/api/src/modules/orders/orders.service.ts',
    "import { C } from '@modelcontextprotocol/sdk/client';\nexport const a = C;",
    IMPORTS,
  ],
  [
    'apps/api/src/modules/payment/maws.client.ts',
    "import { C } from '@modelcontextprotocol/sdk/client';\nexport const a = C;",
    null,
  ],
  [
    'apps/api/src/modules/payment/payment.service.ts',
    "import { L } from '../llm/llm.service';\nexport const a = L;",
    IMPORTS,
  ],
  [
    'apps/api/src/modules/payment/payment.service.ts',
    "import { R } from '../orders/orders.repository';\nexport const a = R;",
    IMPORTS,
  ],
  ['apps/api/src/a.ts', 'export const a: any = 1;', '@typescript-eslint/no-explicit-any'],
  ['apps/api/src/a.ts', "console.log('x');", 'no-console'],
];

let failures = 0;
for (const [path, code, rule] of cases) {
  const [result] = await eslint.lintText(code, { filePath: path });
  const fired = new Set(result.messages.map((m) => m.ruleId));
  const fatal = result.messages.filter((m) => m.fatal);
  let ok;
  if (fatal.length > 0) ok = false;
  else if (rule === null)
    ok =
      !fired.has(IMPORTS) &&
      !fired.has('no-restricted-globals') &&
      !fired.has('no-restricted-properties');
  else ok = fired.has(rule);
  if (!ok) {
    failures += 1;
    console.error(
      `FAIL ${path} expected ${rule ?? 'clean'} got ${[...fired].join(', ') || 'nothing'}\n  ${code.split('\n')[0]}`,
    );
    for (const m of fatal) console.error(`  fatal: ${m.message}`);
  }
}
console.warn(`eslint boundaries: ${cases.length - failures}/${cases.length} ok`);
process.exit(failures ? 1 : 0);
