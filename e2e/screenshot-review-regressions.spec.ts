import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers'

test('slow worker replaces provisional preview instead of leaving it stuck', async ({ page }) => {
  await page.addInitScript((prefs) => {
    localStorage.setItem('scriptor:onboarding-complete', 'true')
    localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(prefs))
    const NativeWorker = window.Worker
    window.Worker = function (url: string | URL, options?: WorkerOptions) {
      if (!String(url).includes('preview.worker')) return new NativeWorker(url, options)
      let terminated = false
      const worker = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        postMessage(request: { id: number }) {
          setTimeout(() => {
            if (!terminated) worker.onmessage?.(new MessageEvent('message', {
              data: { id: request.id, html: '<h1>Delayed worker result</h1>' },
            }))
          }, 1500)
        },
        terminate() { terminated = true },
      }
      return worker as unknown as Worker
    } as unknown as typeof Worker
  }, WORKSPACE_CHROME_PREFS)
  await page.goto('/')
  await waitForWorkspace(page)
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()
  const preview = page.locator('aside[aria-label="Split Markdown preview"]')
  await expect(preview.getByRole('heading', { name: 'Delayed worker result' })).toBeVisible()
  await expect(preview.getByRole('article')).toHaveAttribute('aria-busy', 'false')
})

test('focused graph label uses readable text color on the light canvas', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const label = page.locator('.graph-node.focus text').first()
  await expect(label).toBeVisible()
  expect(await label.evaluate((node) => getComputedStyle(node).fill)).not.toBe('rgb(255, 255, 255)')
})

test('command palette surface is opaque', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  const palette = page.locator('.command-palette')
  await expect(palette).toBeVisible()
  expect(await palette.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toMatch(
    /(?:rgba\([^)]*,\s*0(?:\.0+)?\s*\)|(?:rgb|color)\([^)]*\/\s*0(?:\.0+)?%?\s*\)|^transparent$)/,
  )
})
