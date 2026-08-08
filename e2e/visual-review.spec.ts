import { expect, test, type Page } from '@playwright/test'

import { settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

async function waitForEditorReady(page: Page) {
  await expect(page.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible({
    timeout: 30_000,
  })
  const editor = page.locator('.monaco-editor .view-lines')
  await expect(editor).toBeVisible({ timeout: 45_000 })
  await expect(editor).toContainText('Research Plan', { timeout: 45_000 })
  await settleLayout(page)
}

async function waitForInspectorReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Note Health' })).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.job-progress').getByText('100%')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.widget-action')).toHaveText('Good', { timeout: 45_000 })
  await expect(page.locator('.metric-grid')).toContainText('2', { timeout: 30_000 })
  await settleLayout(page)
}

async function waitForVisualWorkspace(page: Page) {
  await waitForWorkspace(page)
  await waitForInspectorReady(page)
}

async function waitForPreviewReady(page: Page) {
  await expect(page.locator('.markdown-preview h1')).toContainText('Research Plan', {
    timeout: 30_000,
  })
  await expect(page.locator('.preview-error')).toHaveCount(0)
  await settleLayout(page)
}

async function openVisualWorkspace(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForVisualWorkspace(page)
}

async function openMobileWorkspace(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForEditorReady(page)
  await expect(page.getByRole('navigation', { name: 'Mobile workspace navigation' })).toBeVisible()
}

test.describe('visual review states', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((chromePrefs) => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:editor-mode', 'monaco')
      window.localStorage.setItem('scriptor:editor-theme', 'light')
      window.localStorage.setItem('scriptor:headless-engine', 'false')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
      window.localStorage.setItem('scriptor:split-preview', 'false')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
    }, WORKSPACE_CHROME_PREFS)
  })

  test('editor preview-only surface', async ({ page }) => {
    await openVisualWorkspace(page)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
    await waitForPreviewReady(page)

    await expect(page).toHaveScreenshot('visual-editor-preview-only.png', { fullPage: false })
  })

  test('dark workspace with split preview', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
    })
    await openVisualWorkspace(page)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()
    await waitForPreviewReady(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await expect(page).toHaveScreenshot('visual-editor-split-dark.png', { fullPage: false })
  })

  for (const menuName of ['Typography', 'Insert']) {
    test(`${menuName} toolbar popover`, async ({ page }) => {
      await openVisualWorkspace(page)
      const trigger = page.locator('.editor-toolbar').getByRole('button', { name: menuName, exact: true })
      await trigger.focus()
      await page.keyboard.press('ArrowDown')

      const menu = page.getByRole('menu', { name: new RegExp(menuName, 'i') })
      await expect(menu).toBeVisible()
      await expect(menu).toHaveAttribute('data-positioned', 'true')
      await expect(menu.getByRole('menuitem').first()).toBeFocused()
      await expect(menu).toHaveScreenshot(`visual-${menuName.toLowerCase()}-popover.png`, {
        maxDiffPixelRatio: 0.01,
      })
    })
  }

  test('MCP sharing and sync browser state', async ({ page }) => {
    await openVisualWorkspace(page)
    const mcpButton = page.locator('.top-actions button').filter({ hasText: /MCP|Read-only|Write/i })
    await mcpButton.click()
    const mcpPanel = page.getByRole('dialog', { name: /MCP|automation/i })
    await expect(mcpPanel).toBeVisible()
    await mcpPanel.getByRole('tab', { name: 'Sharing & sync' }).click()
    await expect(mcpPanel.getByRole('heading', { name: 'Sharing and sync requires the desktop app' })).toBeVisible()

    await expect(mcpPanel).toHaveScreenshot('visual-mcp-sharing-browser.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('editor recovery fallback', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:editor-render-failure', '1')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()

    const fallback = page.getByRole('alert').filter({ hasText: 'The editor could not be displayed' })
    await expect(fallback).toBeVisible({ timeout: 45_000 })
    await expect(fallback.getByRole('button', { name: 'Retry' })).toBeFocused()
    await expect(fallback).toHaveScreenshot('visual-editor-recovery.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('workspace at 1024px breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForVisualWorkspace(page)

    await expect(page).toHaveScreenshot('visual-workspace-tablet-1024.png', { fullPage: false })
  })

  test('compact mobile editor pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await expect(nav.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-current', 'page')

    await expect(page).toHaveScreenshot('visual-mobile-editor-390.png', { fullPage: false })
  })

  test('compact mobile vault pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await nav.getByRole('button', { name: 'Vault' }).click()
    await expect(nav.getByRole('button', { name: 'Vault' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' })).toBeVisible()
    await settleLayout(page)

    await expect(page).toHaveScreenshot('visual-mobile-vault-390.png', { fullPage: false })
  })

  test('compact mobile inspector pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await nav.getByRole('button', { name: 'Lens' }).click()
    await expect(nav.getByRole('button', { name: 'Lens' })).toHaveAttribute('aria-current', 'page')
    await waitForInspectorReady(page)

    await expect(page).toHaveScreenshot('visual-mobile-inspector-390.png', { fullPage: false })
  })
})
