import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
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
