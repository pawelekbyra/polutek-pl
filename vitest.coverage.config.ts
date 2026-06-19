import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        'tests/unit/**/*.test.ts',
        'tests/integration/launch-candidate-critical-path.test.ts',
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'lib/modules/payments/**',
          'lib/modules/access/**',
          'lib/modules/patron/**',
          'lib/modules/video/application/**',
          'lib/services/playback/**',
        ],
        thresholds: {
          statements: 30,
          branches: 25,
          functions: 30,
          lines: 30,
        },
      },
    },
  }),
);
