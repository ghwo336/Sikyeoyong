// Shared lint rules for every package. Boundaries come from
// docs/wiki/conventions/architecture.md and code-style.md.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const restrict = (patterns) => ['error', { patterns }];

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
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBigInt: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Money must never be a JS number (CLAUDE.md rule 4).
      'no-restricted-globals': ['error', { name: 'parseFloat', message: '금액은 bigint aokrw. parseFloat 금지' }],
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
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['react', 'react-*', 'next', 'next/*', '@nestjs/*', 'better-sqlite3', 'drizzle-orm', 'drizzle-orm/*', 'node:*', '@anthropic-ai/*'], message: 'packages/shared는 런타임 의존 없이 순수하게 (architecture.md)' },
      ]),
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: 'shared에서 환경변수 금지' }],
    },
  },
  {
    files: ['packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['next/navigation', 'next/router', 'next/headers', '@tanstack/*', 'zustand', 'viem', 'ethers', '@sikyeoyong/api', '@sikyeoyong/web'], message: 'ui 컴포넌트는 props와 콜백만 (architecture.md)' },
      ]),
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['viem', 'viem/*', 'ethers', '@anthropic-ai/*', 'better-sqlite3', 'drizzle-orm', 'drizzle-orm/*', '@sikyeoyong/api'], message: '웹에는 결제, 체인, LLM, DB 코드가 없다 (D-18)' },
      ]),
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/modules/payment/**'],
    rules: {
      'no-restricted-imports': restrict([
        { group: ['@modelcontextprotocol/*', '**/maws*', '**/payment/**/maws*'], message: 'MAWS MCP 클라이언트는 payment 모듈 안에서만 (D-06)' },
      ]),
    },
  },
  prettier,
);
