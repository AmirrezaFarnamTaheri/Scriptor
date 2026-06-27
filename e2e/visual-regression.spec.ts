import { expect, test } from '@playwright/test'

import {
  settleLayout,
  waitForWorkspace,
  WORKSPACE_CHROME_PREFS,
} from './helpers.ts'

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((chromePrefs) => {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:editor-mode', 'monaco')
      window.localStorage.setItem('scriptor:headless-engine', 'false')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
      window.localStorage.setItem('scriptor:split-preview', 'false')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
    }, WORKSPACE_CHROME_PREFS)
  })

  test('workspace light mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:editor-theme', 'light')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
    await expect(page).toHaveScreenshot('workspace-light.png')
  })

  test('workspace dark mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:editor-theme', 'dark')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
    await expect(page).toHaveScreenshot('workspace-dark.png')
  })

  test('command palette open', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:editor-theme', 'light')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    await settleLayout(page)
    await expect(page).toHaveScreenshot('command-palette.png')
  })

  test('settings panel', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:editor-theme', 'light')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('searchbox', { name: 'Command palette search' }).fill('Settings')
    await palette.getByRole('option', { name: /Settings/ }).click()

    const settings = page.getByRole('dialog', { name: /Settings/ })
    await expect(settings).toBeVisible()
    await settleLayout(page)
    await expect(page).toHaveScreenshot('settings-panel.png')
  })
})
