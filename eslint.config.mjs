// Shared lint rules for every package. Boundaries come from
// docs/wiki/conventions/architecture.md and code-style.md.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import { builtinModules } from 'node:module';

const restrict = (patterns, paths = []) => ['error', { patterns, paths }];
const NODE_BUILTINS = builtinModules.filter((m) => !m.startsWith('_'));
const UI_AREAS = ['base', 'dragon', 'chat', 'order', 'limits', 'onboarding', 'wallet'];
// Nest modules (architecture.md "API"). A module may reach another module only
// through its exported service or its Nest module class.
const API_MODULES = [
  'auth',
  'identity',
  'allowance',
  'wallet',
  'pouchi',
  'users',
  'agents',
  'payment',
  'orders',
  'merchants',
  'recommend',
  'budget',
  'approvals',
  'owner-approvals',
  'llm',
  'chain',
  'indexer',
  'delivery',
  'admin',
  'demo',
  'merchant-api',
];
// Pairs that may not talk at all, not even through a service (code-style.md, D-06):
// payment never sees the LLM, and the LLM never reaches payment directly.
const API_FORBIDDEN_PAIRS = { payment: ['llm'], llm: ['payment'] };
const MONEY_GLOBALS = [{ name: 'parseFloat', message: '금액은 bigint aokrw. parseFloat 금지' }];
const API_DB_PATTERN = {
  group: ['**/db', '**/db/**', 'drizzle-orm', 'drizzle-orm/*', 'better-sqlite3'],
  message: '서비스와 컨트롤러는 DB를 직접 쓰지 않는다. 저장소만 (architecture.md)',
};
const MAWS_PATTERN = {
  group: ['@modelcontextprotocol/*', '**/maws*', '**/payment/**/maws*'],
  message: 'MAWS MCP 클라이언트는 payment 모듈 안에서만 (D-06)',
};

const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Relative imports only, at any depth. gitignore-style globs cannot re-include a file under an
// excluded folder, so these are regexes.
function apiModulePatterns(own) {
  return API_MODULES.filter((m) => m !== own).map((other) => {
    const forbidden = API_FORBIDDEN_PAIRS[own]?.includes(other);
    const name = escapeRe(other);
    const rest = forbidden ? '(/.*)?' : `(/(?!${name}\\.(service|module)(\\.js)?$).*)?`;
    return {
      regex: `^\\.{1,2}/(.*/)?${name}${rest}$`,
      message: forbidden
        ? `${own} 모듈은 ${other} 모듈을 import하지 않는다 (code-style.md, D-06)`
        : `다른 모듈(${other})은 ${other}.service와 ${other}.module로만 (architecture.md)`,
    };
  });
}

function apiBlocks(own) {
  const base = own ? `apps/api/src/modules/${own}/**` : 'apps/api/src/**';
  const ignores = own ? [] : ['apps/api/src/modules/**'];
  const patterns = [
    ...(own ? apiModulePatterns(own) : []),
    ...(own === 'payment' ? [] : [MAWS_PATTERN]),
  ];
  return [
    { files: [`${base}/*.ts`], ignores, rules: { 'no-restricted-imports': restrict(patterns) } },
    {
      files: [`${base}/*.{service,controller}.ts`],
      ignores,
      rules: { 'no-restricted-imports': restrict([...patterns, API_DB_PATTERN]) },
    },
  ];
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-rehearsal/**',
      '**/.next/**',
      '**/.next-rehearsal/**',
      '**/.next-*/**',
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
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Nest modules are empty classes carrying a @Module decorator (api only).
  {
    files: ['apps/api/src/**/*.ts'],
    rules: { '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }] },
  },
  // shared: pure. No runtime deps, no node builtins, no env, no network (architecture.md, code-style.md).
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict(
        [
          {
            group: [
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
        ],
        NODE_BUILTINS.map((name) => ({
          name,
          message: 'shared에서 node 내장 모듈 금지 (architecture.md)',
        })),
      ),
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: 'shared에서 동적 import 금지' },
        {
          selector: "MemberExpression[object.name='globalThis']",
          message: 'shared에서 globalThis 접근 금지',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'shared에서 환경변수 금지' },
      ],
      'no-restricted-globals': [
        'error',
        ...MONEY_GLOBALS,
        { name: 'fetch', message: 'shared에서 네트워크 금지. API 클라이언트는 fetch를 주입받는다' },
        { name: 'process', message: 'shared에서 process 금지' },
        ...['self', 'window', 'eval', 'Function'].map((name) => ({
          name,
          message: 'shared에서 런타임 전역 금지 (architecture.md)',
        })),
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
            '@sikyeoyong/ui',
            '@sikyeoyong/ui/*',
          ],
          message: 'ui 컴포넌트는 props와 콜백만 (architecture.md)',
        },
        {
          regex:
            '^(\\./)?\\.\\.(/\\.\\.)*(/index(\\.[cm]?[jt]sx?)?)?/?$|(^|/)src(/index(\\.[cm]?[jt]sx?)?)?/?$',
          message: 'ui 루트 배럴로 다른 영역을 우회해서 가져오지 않는다 (architecture.md)',
        },
        ...(['base', 'dragon'].includes(area)
          ? []
          : [
              {
                group: UI_AREAS.filter((a) => !['base', 'dragon', area].includes(a)).flatMap(
                  (a) => [`**/${a}`, `**/${a}/**`],
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
  // api: modules talk through exported services only, at any folder depth; MAWS only inside
  // payment; only repositories (and module wiring) touch the DB layer (D-06, D-18, architecture.md).
  ...apiBlocks(null),
  ...API_MODULES.flatMap((m) => apiBlocks(m)),
  prettier,
);
