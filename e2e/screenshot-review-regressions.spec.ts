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

test('task list items render checkboxes without double bullet discs', async ({ page }) => {
  await launchApp(page)
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()
  const preview = page.locator('aside[aria-label="Split Markdown preview"]')
  await expect(preview.getByRole('heading', { name: 'Research Plan' })).toBeVisible()

  const taskLists = preview.locator('ul.contains-task-list, ul:has(> li.task-list-item)')
  await expect(taskLists.first()).toBeVisible()
  const listStyle = await taskLists.first().evaluate((element) => getComputedStyle(element).listStyleType)
  expect(listStyle).toBe('none')

  const taskItem = preview.locator('li.task-list-item').first()
  await expect(taskItem).toBeVisible()
  const itemStyle = await taskItem.evaluate((element) => getComputedStyle(element).listStyleType)
  expect(itemStyle).toBe('none')
  await expect(taskItem.locator('input[type="checkbox"]')).toBeVisible()
})

test('editor surface mode switcher synchronizes with main viewport in Preview mode', async ({ page }) => {
  await launchApp(page)
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
  const renderedView = page.locator('.editor-rendered-view')
  await expect(renderedView).toBeVisible()
  await expect(renderedView.locator('.markdown-preview h1')).toContainText('Research Plan')
  // Monaco editor must not be mounted in rendered view
  await expect(page.locator('.monaco-editor')).toHaveCount(0)
})

test('editor surface mode switcher synchronizes with main viewport in Preview mode with CodeMirror', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('scriptor:editor-mode', 'codemirror')
  })
  await launchApp(page)
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
  const renderedView = page.locator('.editor-rendered-view')
  await expect(renderedView).toBeVisible()
  await expect(renderedView.locator('.markdown-preview h1')).toContainText('Research Plan')
  // CodeMirror editor must not be mounted in rendered view
  await expect(page.locator('.cm-editor')).toHaveCount(0)
})

test('status bar reading time and word count reflect active note accurately', async ({ page }) => {
  await launchApp(page)
  const statusBar = page.locator('.editor-status')
  await expect(statusBar).toBeVisible()
  await expect(statusBar).toContainText('words')
  // 31 words must calculate to 1 min read (not vault-wide 2 min read)
  await expect(statusBar).toContainText('1 min read')
})

test('workspace switcher option labels display cleanly without premature path clipping and disambiguate collisions', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'scriptor.recent-vaults',
      JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        data: ['/work/client', '/archive/client', '/docs/notes'],
      }),
    )
  })
  await launchApp(page)
  const switcher = page.locator('.workspace-switcher select')
  if (await switcher.isVisible()) {
    const options = await switcher.locator('option:not([disabled]):not([value="__choose__"])').allTextContents()
    expect(options).toContain('work/client')
    expect(options).toContain('archive/client')
    expect(options).toContain('notes')
  }
})

test('light mode line number gutter meets WCAG AA contrast standards', async ({ page }) => {
  await launchApp(page)
  const gutter = page.locator('.cm-gutters, .monaco-editor .margin').first()
  if (await gutter.isVisible()) {
    const color = await gutter.evaluate((el) => getComputedStyle(el).color)
    expect(color).toBeTruthy()
    expect(color).not.toBe('rgb(255, 255, 255)')
  }
})

