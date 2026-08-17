import { defineConfig, devices } from '@playwright/test'

const systemChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'
const serverPort = Number(process.env.SCRIPTOR_E2E_PORT ?? 4184)

export default defineConfig({
  testDir: 'e2e',
  testIgnore: /(?:screenshots|visual-review)\.spec\.ts$/,
  timeout: 120_000,
  // Release-gating runs must expose flakes rather than retry them into green.
  retries: 0,
  // Keep lazy panel imports within deterministic resource budgets on hosted
  // Windows runners. Unbounded worker fan-out can starve chunk evaluation and
  // leave otherwise healthy panels suspended behind their loading fallback.
  workers: process.env.CI ? 2 : undefined,
  expect: {
    timeout: 30_000,
  },
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }],
      ]
    : 'list',
  outputDir: 'test-results/e2e',
  use: {
    ...devices['Desktop Edge'],
    channel: systemChannel,
    baseURL: `http://127.0.0.1:${serverPort}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `node_modules\\.bin\\vite.cmd build --mode e2e && node_modules\\.bin\\vite.cmd preview --host 127.0.0.1 --port ${serverPort} --strictPort`,
    port: serverPort,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
