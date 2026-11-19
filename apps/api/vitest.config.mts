import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which Nest dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts'],
    passWithNoTests: false,
    // Tests never touch a database file unless a test opens one itself.
    env: { DATABASE_URL: ':memory:' },
  },
});
