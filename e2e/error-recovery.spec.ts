import { expect, test } from '@playwright/test'

import { WORKSPACE_CHROME_PREFS } from './helpers.ts'

test.describe('workspace error recovery', () => {
  test('editor render failure offers a CodeMirror recovery path and restores the active note', async ({ page }) => {
    await page.addInitScript((chromePrefs) => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:editor-mode', 'monaco')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
      window.sessionStorage.setItem('e2e:editor-render-failure', '1')
    }, WORKSPACE_CHROME_PREFS)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()

    const fallback = page.getByRole('alert').filter({ hasText: 'The editor could not be displayed' })
    await expect(fallback).toBeVisible({ timeout: 45_000 })
    const switchEditor = fallback.getByRole('button', { name: 'Switch to CodeMirror' })
    await expect(switchEditor).toBeVisible()
    await expect(switchEditor).toBeFocused()

    await switchEditor.click()

    await expect(fallback).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('.cm-content')).toContainText('Research Plan', {
      timeout: 45_000,
    })
    await expect(page.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible()
  })
})
