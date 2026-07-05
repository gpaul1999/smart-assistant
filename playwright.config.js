import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1, // dùng chung 1 browser context có extension
  reporter: [['list']],
  outputDir: 'test-results',
});
