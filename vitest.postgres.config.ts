import { defineConfig } from 'vitest/config';
import path from 'path';

/** Tests that need a real Postgres (DATABASE_URL); run by `npm run test:integration:postgres` in CI. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/postgres/**/*.pg.test.ts', 'tests/integration/email-event-idempotency.test.ts'],
    env: { RUN_INTEGRATION_TESTS: 'true' },
    fileParallelism: false,
    testTimeout: 30_000,
    alias: {
      '@admin': path.resolve(__dirname, './apps/admin'),
      '@': path.resolve(__dirname, './'),
    },
  },
});
