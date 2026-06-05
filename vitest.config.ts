import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'app/api/**',
        'lib/services/**',
        'lib/access/**',
        'lib/webhooks/**',
      ],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 40,
        lines: 30,
      },
    },
  },
});
