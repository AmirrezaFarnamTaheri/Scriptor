import { expect, test } from '@playwright/test'

import { appendEditorLine, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

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
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
  })

  test('extension failures preserve inspector and split preview content', async ({ page }) => {
    const editorToolbar = page.locator('.editor-toolbar')
    await expect(editorToolbar).toBeVisible()
    const sourceButton = editorToolbar.getByRole('button', { name: 'Source', exact: true })
    const splitButton = editorToolbar.getByRole('button', { name: 'Split', exact: true })
    await expect(sourceButton).toBeVisible()
    await expect(splitButton).toBeVisible()
    if ((await sourceButton.getAttribute('aria-pressed')) !== 'true') {
      await sourceButton.click()
    }
    await expect(sourceButton).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('aside[aria-label="Split Markdown preview"]')).toHaveCount(0)

    await page.getByRole('tab', { name: 'Rendered output', exact: true }).click()

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

    await splitButton.click()
    await expect(splitButton).toHaveAttribute('aria-pressed', 'true')

    const splitPane = page.locator('aside[aria-label="Split Markdown preview"]')
    const splitPreview = splitPane.locator('.editable-preview-editor')
    await expect(splitPreview.locator('.cm-content')).toContainText('Research Plan', {
      timeout: 10_000,
    })
    await expect(splitPreview).not.toHaveAttribute('data-preview-degraded', 'true')

    await expect(page.locator('.monaco-editor .view-lines')).toContainText('Research Plan')
    await expect(page.getByText(/could not be displayed/i)).toHaveCount(0)
  })

  test('Preview and Split render Mermaid while keeping fenced blocks editable', async ({ page }) => {
    await page.evaluate(() => {
      const editor = (window as Window & {
        __scriptorE2eEditor?: { getModel?: () => { setValue?: (value: string) => void } | null }
      }).__scriptorE2eEditor
      editor?.getModel?.()?.setValue?.([
        '# Diagram',
        '',
        '```mermaid',
        'classDiagram',
        '  class Animal',
        '```',
        '',
        '```powershell',
        'Write-Output "hello"',
        '```',
      ].join('\n'))
    })
    await page.waitForTimeout(500)

    const editorToolbar = page.locator('.editor-toolbar')
    await editorToolbar.getByRole('button', { name: 'Preview', exact: true }).click()
    const preview = page.locator('.editor-rendered-view .editable-preview-editor')
    await expect(preview.locator('.cm-visual-block .mermaid svg')).toBeAttached({ timeout: 15_000 })
    await expect(preview.locator('.cm-visual-block')).toHaveCount(2)
    await expect(preview.locator('.cm-content')).not.toContainText('classDiagram')

    await preview.locator('.cm-visual-block').first().click()
    await expect(preview.locator('.cm-content')).toContainText('classDiagram')
    await expect(preview.locator('.cm-visual-block')).toHaveCount(1)

    await preview.locator('.cm-line').first().click()
    await editorToolbar.getByRole('button', { name: 'Split', exact: true }).click()
    const split = page.locator('aside .editable-preview-editor')
    await expect(split.locator('.cm-visual-block .mermaid svg')).toBeAttached({ timeout: 15_000 })
    await expect(split.locator('.cm-content')).not.toContainText('classDiagram')
    await expect(split.locator('.cm-visual-block pre')).toHaveCount(1)
  })

  test('Preview mode is writable by default and preserves edits when returning to Source', async ({ page }) => {
    const editorToolbar = page.locator('.editor-toolbar')
    await editorToolbar.getByRole('button', { name: 'Preview', exact: true }).click()

    const visualPreview = page.locator('.editor-rendered-view .editable-preview-editor')
    const previewLines = visualPreview.locator('.cm-line')
    await expect(previewLines.first()).toBeVisible({ timeout: 10_000 })

    const marker = 'Written directly in Preview mode.'
    await previewLines.last().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type(marker)
    await expect(visualPreview.locator('.cm-content')).toContainText(marker)

    await editorToolbar.getByRole('button', { name: 'Source', exact: true }).click()
    await expect(page.locator('.monaco-editor .view-lines')).toContainText(marker, {
      timeout: 10_000,
    })
  })

  test('formatting toolbar targets the last active side of Split', async ({ page }) => {
    const editorToolbar = page.locator('.editor-toolbar')
    await editorToolbar.getByRole('button', { name: 'Split', exact: true }).click()

    const splitPane = page.locator('aside[aria-label="Split Markdown preview"]')
    const previewLines = splitPane.locator('.editable-preview-editor .cm-line')
    await expect(previewLines.first()).toBeVisible()

    const marker = 'Preview toolbar target'
    await previewLines.last().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type(marker)
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('End')
    await page.keyboard.up('Shift')

    await editorToolbar.getByRole('button', { name: 'Bold', exact: true }).click()

    await expect.poll(async () =>
      page.evaluate((needle) => {
        const editor = (window as Window & {
          __scriptorE2eEditor?: { getModel?: () => { getValue?: () => string } | null }
        }).__scriptorE2eEditor
        return editor?.getModel?.()?.getValue?.().includes(`**${needle}**`) ?? false
      }, marker),
      { timeout: 10_000 },
    ).toBe(true)
  })

  test('split preview is writable and stays synchronized with source edits', async ({ page }) => {
    const editorToolbar = page.locator('.editor-toolbar')
    await editorToolbar.getByRole('button', { name: 'Split', exact: true }).click()

    const splitPane = page.locator('aside[aria-label="Split Markdown preview"]')
    const previewLines = splitPane.locator('.editable-preview-editor .cm-line')
    await expect(previewLines.first()).toBeVisible()

    const sourceMarker = 'Source line mirrored into editable preview.'
    await appendEditorLine(page, sourceMarker)
    await expect(splitPane.locator('.editable-preview-editor .cm-content')).toContainText(sourceMarker, {
      timeout: 10_000,
    })

    const previewMarker = 'Line typed directly in Preview.'
    await previewLines.last().click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type(previewMarker)

    await expect(page.locator('.monaco-editor .view-lines')).toContainText(previewMarker, {
      timeout: 10_000,
    })
    await expect(splitPane.locator('.editable-preview-editor .cm-content')).toContainText(previewMarker)
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
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
  })

  test('falls back to main-thread rendering when the inspector preview worker never responds', async ({ page }) => {
    await page.getByRole('tab', { name: 'Rendered output', exact: true }).click()

    const inspectorPreview = page
      .locator('.inspector-panel')
      .getByRole('article', { name: 'Markdown preview' })
    await expect(inspectorPreview.getByRole('heading', { name: 'Research Plan' })).toBeVisible({
      timeout: 8_000,
    })
    await expect(inspectorPreview).toHaveAttribute('aria-busy', 'false')
  })
})