import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Generous limits, because many tests import heavy modules (Better Auth, Prisma, Stripe) inside the
    // test body: on a cold or busy machine the first import alone took 30-55 s (auth-instance.test.ts),
    // while CI on Linux needs ~1 s. A timeout here only means "slow machine", never a wrong result,
    // and a real hang still fails. Local CI: docs/operations/LOCAL-CI.md.
    testTimeout: 90_000,
    hookTimeout: 90_000,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/integration/**/*.test.ts'],
    alias: {
      '@admin': path.resolve(__dirname, './apps/admin'),
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'app/api/**',
        'lib/modules/**',
        'lib/services/**',
        'lib/api/**',
        'lib/auth-utils.ts',
        'lib/webhooks/**',
        'apps/admin/lib/**',
        'apps/admin/proxy.ts',
      ],
    },
  },
});
