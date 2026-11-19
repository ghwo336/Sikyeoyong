import { defineConfig } from 'drizzle-kit';

// `pnpm --filter @sikyeoyong/api db:generate` writes SQL migrations from the schema.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
});
