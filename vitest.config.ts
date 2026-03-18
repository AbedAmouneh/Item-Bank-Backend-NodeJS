import { defineConfig } from 'vitest/config';

const coverageConfig: any = {
  provider: 'v8',
  all: true,
  include: [
    'controllers/**/*.ts',
    'platform/**/*.ts',
    'routes/**/*.ts',
    'runmodes/**/*.ts',
    'services/**/*.ts',
    'utils/**/*.ts',
    'tests/setup/scripts/**/*.ts',
  ],
  exclude: [
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
    'tests/**',
    'dist/**',
    'coverage/**',
    'node_modules/**',
    'controllers/**/models/**',
    'controllers/**/types/**',
  ],
  reporter: ['text', 'lcov', 'json-summary'],
  thresholds: {
    lines: 0,
    statements: 0,
    functions: 0,
    branches: 0,
  },
};

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/env.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    reporters: ['default'],
    coverage: coverageConfig,
  },
});
