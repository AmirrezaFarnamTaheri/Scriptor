import { defineConfig, devices } from '@playwright/test'

const systemChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  timeout: 120_000,
  expect: {
    timeout: 30_000,
  },
  use: {
    ...devices['Desktop Edge'],
    channel: systemChannel,
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
  },
  webServer: {
    command: 'pnpm exec vite build --mode e2e && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
