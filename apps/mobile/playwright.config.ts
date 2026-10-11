import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', timeout: 30_000, workers: 1,
  outputDir: '../../test-results/mobile',
  use: { baseURL: 'http://127.0.0.1:1421', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge' },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:1421', reuseExistingServer: false },
})
