import { defineConfig, devices } from '@playwright/test'

const systemChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: 'e2e',
  testMatch: /visual-regression\.spec\.ts$/,
  timeout: 120_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.03,
      threshold: 0.15,
    },
  },
  outputDir: 'test-results/visual',
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  use: {
    ...devices['Desktop Edge'],
    channel: systemChannel,
    baseURL: 'http://127.0.0.1:4184',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
  },
  webServer: {
    command: 'pnpm vite build --mode e2e && pnpm vite preview --host 127.0.0.1 --port 4184 --strictPort',
    port: 4184,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
