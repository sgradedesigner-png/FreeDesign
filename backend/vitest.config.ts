import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// CRITICAL: Load .env.test BEFORE anything else
dotenv.config({ path: path.resolve(__dirname, '.env.test'), override: true });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      // Force test environment variables
      NODE_ENV: 'test'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/',
        'prisma/',
        'src/test-*.ts'
      ],
      all: true,
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70
      }
    },
    testTimeout: 30000, // 30 seconds for tests that hit database
    hookTimeout: 30000,
    teardownTimeout: 10000,
    // Run all tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    fileParallelism: false,
    sequence: {
      concurrent: false
    },
    maxConcurrency: 1
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
