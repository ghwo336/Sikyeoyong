// Shared lint rules for every package. Boundaries come from
// docs/wiki/conventions/architecture.md and code-style.md.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import { builtinModules } from 'node:module';

const restrict = (patterns) => ['error', { patterns }];
const NODE_BUILTINS = builtinModules.filter((m) => !m.startsWith('_'));
const UI_AREAS = ['base', 'dragon', 'chat', 'order', 'limits', 'onboarding', 'wallet'];
const MONEY_GLOBALS = [{ name: 'parseFloat', message: '금액은 bigint aokrw. parseFloat 금지' }];
const API_MODULE_PATTERNS = [
  {
    group: [
      '../*/*.repository',
      '../*/*.repository.*',
      '../*/repository',
      '../*/repository/**',
      '../*/*.schema',
    ],
    message: '다른 모듈의 저장소와 테이블은 직접 쓰지 않는다. 내보낸 service만 (architecture.md)',
  },
];
const API_DB_PATTERN = {
  group: ['**/db', '**/db/**', 'drizzle-orm', 'drizzle-orm/*', 'better-sqlite3'],
  message: '서비스와 컨트롤러는 DB를 직접 쓰지 않는다. 저장소만 (architecture.md)',
};
const PAYMENT_NO_LLM = {
  group: ['../llm', '../llm/**'],
  message: 'payment는 llm을 import하지 않는다 (code-style.md)',
};
const MAWS_PATTERN = {
  group: ['@modelcontextprotocol/*', '**/maws*', '**/payment/**/maws*'],
  message: 'MAWS MCP 클라이언트는 payment 모듈 안에서만 (D-06)',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '**/next-env.d.ts',
      'contracts/**',
      'docs/**',
      'design/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Money must never be a JS number (CLAUDE.md rule 4).
      'no-restricted-globals': ['error', ...MONEY_GLOBALS],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // shared: pure. No runtime deps, no node builtins, no env, no network (architecture.md, code-style.md).
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        {
          group: [
            ...NODE_BUILTINS,
            'node:*',
            'react',
            'react-*',
            'next',
            'next/*',
            '@nestjs/*',
            'better-sqlite3',
            'drizzle-orm',
            'drizzle-orm/*',
            '@anthropic-ai/*',
            'ethers',
          ],
          message: 'packages/shared는 런타임 의존 없이 순수하게 (architecture.md)',
        },
        {
          group: ['viem', 'viem/*'],
          allowTypeImports: true,
          message: 'shared에는 viem 타입만. 클라이언트는 apps/api',
        },
        {
          group: ['**/apps/**', '@sikyeoyong/ui', '@sikyeoyong/api', '@sikyeoyong/web'],
          message: 'shared는 아무것도 import하지 않는다',
        },
      ]),
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'shared에서 환경변수 금지' },
      ],
      'no-restricted-globals': [
        'error',
        ...MONEY_GLOBALS,
        { name: 'fetch', message: 'shared에서 네트워크 금지. API 클라이언트는 fetch를 주입받는다' },
        { name: 'process', message: 'shared에서 process 금지' },
      ],
    },
  },
  // ui: draw only. Cross-area imports only into base and dragon.
  ...UI_AREAS.map((area) => ({
    files: [`packages/ui/src/${area}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': restrict([
        {
          group: [
            'next/navigation',
            'next/router',
            'next/headers',
            '@tanstack/*',
            'zustand',
            'viem',
            'viem/*',
            'ethers',
            '@sikyeoyong/api',
            '@sikyeoyong/web',
            '**/apps/**',
          ],
          message: 'ui 컴포넌트는 props와 콜백만 (architecture.md)',
        },
        ...(['base', 'dragon'].includes(area)
          ? []
          : [
              {
                group: UI_AREAS.filter((a) => !['base', 'dragon', area].includes(a)).map(
                  (a) => `**/${a}/**`,
                ),
                message: '영역 사이 import는 base와 dragon만 (architecture.md)',
              },
            ]),
      ]),
      'no-restricted-globals': [
        'error',
        ...MONEY_GLOBALS,
        { name: 'fetch', message: 'ui 컴포넌트에서 fetch 금지' },
      ],
    },
  })),
  // web: screens only. No payment, chain, LLM, DB code (D-18).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([
        {
          group: [
            'viem',
            'viem/*',
            'ethers',
            '@anthropic-ai/*',
            'better-sqlite3',
            'drizzle-orm',
            'drizzle-orm/*',
            '@sikyeoyong/api',
            '**/apps/api/**',
            '**/api/src/**',
          ],
          message: '웹에는 결제, 체인, LLM, DB 코드가 없다 (D-18)',
        },
      ]),
    },
  },
  // api: modules talk through exported services only; MAWS only inside payment; only
  // repositories (and module wiring) touch the DB layer (D-06, D-18, architecture.md).
  ...[
    {
      files: ['apps/api/src/**/*.ts'],
      ignores: ['apps/api/src/modules/payment/**'],
      extra: [MAWS_PATTERN],
    },
    { files: ['apps/api/src/modules/payment/**/*.ts'], extra: [PAYMENT_NO_LLM] },
  ].flatMap(({ files, ignores = [], extra }) => [
    {
      files,
      ignores,
      rules: { 'no-restricted-imports': restrict([...API_MODULE_PATTERNS, ...extra]) },
    },
    {
      files: files.map((f) => f.replace('**/*.ts', '**/*.{service,controller}.ts')),
      ignores,
      rules: {
        'no-restricted-imports': restrict([...API_MODULE_PATTERNS, ...extra, API_DB_PATTERN]),
      },
    },
  ]),
  prettier,
);
