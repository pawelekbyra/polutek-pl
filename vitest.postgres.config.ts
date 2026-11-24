import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Tests that need a real Postgres (DATABASE_URL). CI: job "postgres" in .github/workflows/ci.yml (PG 17), locally
 * `npm run test:integration:postgres` or scripts/ops/local-ci.mjs.
 *
 * "Stack" tests also need heavy tools (next dev, ffmpeg, Chromium, the video worker). They are excluded from the
 * normal run and selected alone with PG_STACK=1 (CI job "heavy", on demand). List them here explicitly so they are
 * never skipped silently: a stack test that lacks its tools must fail, not skip.
 */
const STACK_TESTS = [
  'tests/postgres/k01-video-worker-local.pg.test.ts',
  'tests/postgres/k10-hidden-premiere-http.pg.test.ts',
  'tests/postgres/k23-publish-crash-cron-http.pg.test.ts',
  'tests/postgres/user-export-http.pg.test.ts',
];
const stackOnly = process.env.PG_STACK === '1';

export default defineConfig({
  test: {
    environment: 'node',
    include: stackOnly
      ? STACK_TESTS
      : ['tests/postgres/**/*.pg.test.ts', 'tests/integration/email-event-idempotency.test.ts'],
    exclude: stackOnly ? [] : ['**/node_modules/**', ...STACK_TESTS],
    // email-event-idempotency.test.ts runs its real-DB cases only with this flag (skipped in the unit run).
    env: { RUN_INTEGRATION_TESTS: 'true' },
    fileParallelism: false,
    testTimeout: stackOnly ? 180_000 : 30_000,
    alias: {
      '@admin': path.resolve(__dirname, './apps/admin'),
      '@': path.resolve(__dirname, './'),
    },
  },
});
