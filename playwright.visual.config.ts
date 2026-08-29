import { defineConfig, devices } from '@playwright/test'

const systemChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge'
const serverPort = Number(process.env.SCRIPTOR_VISUAL_PORT ?? 4185)

export default defineConfig({
  testDir: 'e2e',
  testMatch: /(?:screenshots|visual-review)\.spec\.ts$/,
  timeout: 120_000,
  // A changed visual baseline needs explicit review, never retry masking.
  retries: 0,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.03,
      threshold: 0.15,
    },
  },
  reporter: process.env.CI
    ? [
        ['line'],
        ['html', { outputFolder: 'playwright-report/visual', open: 'never' }],
      ]
    : 'list',
  outputDir: 'test-results/visual',
  updateSnapshots: process.env.CI ? 'none' : 'missing',
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
    command: `node_modules\\.bin\\vite.cmd build --mode e2e --outDir dist-visual-e2e && node_modules\\.bin\\vite.cmd preview --outDir dist-visual-e2e --host 127.0.0.1 --port ${serverPort} --strictPort`,
    env: {
      VITE_SCREENSHOT_MODE: 'true',
    },
    port: serverPort,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
