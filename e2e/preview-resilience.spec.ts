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
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
      window.sessionStorage.setItem('e2e:preview-postprocess-failure', '1')
    }, WORKSPACE_CHROME_PREFS)
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
  })

  test('extension failures preserve inspector and split preview content', async ({ page }) => {
    const editorToolbar = page.locator('.editor-toolbar')
    await expect(editorToolbar).toBeVisible()
    const sourceButton = editorToolbar.getByRole('button', { name: 'Source', exact: true })
    await expect(sourceButton).toBeVisible()
    if (!(await sourceButton.evaluate((button) => button.classList.contains('active')))) {
      await sourceButton.click()
      await expect(sourceButton).toHaveClass(/active/)
    }

    const splitPreviewToggle = editorToolbar.getByRole('button', { name: 'Toggle split preview' })
    await expect(splitPreviewToggle).toBeVisible()
    if ((await splitPreviewToggle.getAttribute('aria-pressed')) === 'true') {
      await splitPreviewToggle.click()
      await expect(splitPreviewToggle).toHaveAttribute('aria-pressed', 'false')
    }

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

    await splitPreviewToggle.click()
    await expect(splitPreviewToggle).toHaveAttribute('aria-pressed', 'true')

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

test.describe('Markdown preview worker recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((chromePrefs) => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:editor-mode', 'monaco')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
    }, WORKSPACE_CHROME_PREFS)
    await page.addInitScript(() => {
      const NativeWorker = window.Worker
      const WorkerProxy = function (
        this: Worker,
        scriptURL: string | URL,
        options?: WorkerOptions,
      ) {
        if (!String(scriptURL).includes('preview.worker')) {
          return new NativeWorker(scriptURL, options)
        }
        return {
          onerror: null,
          onmessage: null,
          onmessageerror: null,
          postMessage: () => undefined,
          terminate: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => true,
        } as unknown as Worker
      }
      window.Worker = WorkerProxy as unknown as typeof Worker
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
  })

  test('falls back to main-thread rendering when the preview worker never responds', async ({ page }) => {
    const editorToolbar = page.locator('.editor-toolbar')
    await editorToolbar.getByRole('button', { name: 'Split', exact: true }).click()

    const splitPreview = page
      .locator('aside[aria-label="Split Markdown preview"]')
      .getByRole('article', { name: 'Markdown preview' })
    await expect(splitPreview).toHaveAttribute('aria-busy', 'true')
    await expect(splitPreview.getByRole('heading', { name: 'Research Plan' })).toBeVisible({
      timeout: 8_000,
    })
    await expect(splitPreview).toHaveAttribute('aria-busy', 'false')
  })
})
