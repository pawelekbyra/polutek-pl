import { defineConfig } from 'vitest/config';
import path from 'path';

/** Tests that need a real Postgres (DATABASE_URL); run by `npm run test:integration:postgres` in CI. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/postgres/**/*.pg.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
