import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['src/__integration__/setup.ts'],
  },
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
});
