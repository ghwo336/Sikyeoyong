import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Containers and pure helpers only; pages are assembly and are not tested (web.md).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Not Seoul on purpose: KST formatting must not lean on the machine time zone.
    env: { TZ: 'America/Los_Angeles' },
    setupFiles: ['./test-setup.ts'],
    include: ['{features,lib}/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
