import { expect, test } from '@playwright/test'

import { waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

test.describe('Markdown preview resilience', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((chromePrefs) => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:editor-mode', 'monaco')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
      window.localStorage.setItem('scriptor:split-preview', 'false')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
      window.sessionStorage.setItem('e2e:preview-postprocess-failure', '1')
    }, WORKSPACE_CHROME_PREFS)
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
  })

  test('extension failures preserve inspector and split preview content', async ({ page }) => {
    await page.getByRole('tab', { name: 'Preview', exact: true }).click()

    const inspectorPreview = page
      .locator('.inspector-panel')
      .getByRole('article', { name: 'Markdown preview' })
    await expect(inspectorPreview).toHaveAttribute('data-preview-degraded', 'true', {
      timeout: 10_000,
    })
    await expect(inspectorPreview.getByRole('heading', { name: 'Research Plan' })).toBeVisible()
    await expect(inspectorPreview.getByRole('status')).toContainText(
      'Showing the core Markdown render',
    )
    await expect(inspectorPreview.getByRole('alert')).toHaveCount(0)

    await page
      .locator('.editor-toolbar')
      .getByRole('button', { name: 'Split', exact: true })
      .click()

    const splitPane = page.locator('aside[aria-label="Split Markdown preview"]')
    const splitPreview = splitPane.getByRole('article', { name: 'Markdown preview' })
    await expect(splitPreview).toHaveAttribute('data-preview-degraded', 'true', {
      timeout: 10_000,
    })
    await expect(splitPreview.getByRole('heading', { name: 'Research Plan' })).toBeVisible()
    await expect(splitPreview.getByRole('status')).toContainText(
      'Showing the core Markdown render',
    )
    await expect(splitPreview.getByRole('alert')).toHaveCount(0)

    await expect(page.locator('.monaco-editor .view-lines')).toContainText('Research Plan')
    await expect(page.getByText(/could not be displayed/i)).toHaveCount(0)
  })
})
