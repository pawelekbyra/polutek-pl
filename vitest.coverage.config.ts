import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/launch-candidate-critical-path.test.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/modules/payments/**', 'lib/modules/access/**', 'lib/modules/patron/**', 'lib/modules/video/application/**', 'lib/services/playback/**'],
      thresholds: {
        statements: 20,
        branches: 10,
        functions: 20,
        lines: 20
      }
    }
  }
});
