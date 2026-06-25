import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = path.join(rootDir, 'docs/assets/screenshots')

const WORKSPACE_CHROME_PREFS = {
  vaultSidebarCollapsed: false,
  inspectorCollapsed: false,
  showFormatToolbar: true,
  showEditorAssist: true,
  showEditorStatus: true,
  showInspectorHealth: true,
  showWorkspaceFooter: true,
  showLineNumbers: true,
  editorFontSize: 14,
  editorFontFamily: 'jetbrains-mono',
  editorLineHeight: 1.55,
  editorPaddingPx: 12,
  previewMaxWidthCh: 72,
  editorSurfaceMode: 'source',
}

function shotPath(name: string) {
  return path.join(outputDir, `${name}.png`)
}

async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    window.dispatchEvent(new Event('resize'))
  })
  await page.waitForTimeout(400)
}

async function waitForVaultSidebarReady(page: Page) {
  const vaultList = page.locator('.virtual-note-list')
  await expect(vaultList.getByRole('button', { name: 'Research Plan.md' })).toBeVisible({
    timeout: 45_000,
  })
  await expect(vaultList.getByRole('button', { name: 'Field Notes.md' })).toBeVisible()
  await expect(vaultList.getByRole('button', { name: 'Methodology.md' })).toBeVisible()
}

async function waitForMonacoPainted(page: Page) {
  const lines = page.locator('.monaco-editor .view-lines')
  await expect(lines).toBeVisible({ timeout: 45_000 })
  await expect(lines).toContainText('Research Plan', { timeout: 45_000 })
  await expect(page.locator('.monaco-editor')).not.toContainText('Loading...', { timeout: 45_000 })
  await page.waitForFunction(() => {
    const viewLines = document.querySelector('.monaco-editor .view-lines')
    if (!viewLines) return false
    const rect = viewLines.getBoundingClientRect()
    return rect.width > 80 && rect.height > 20
  }, { timeout: 20_000 })
  await settleLayout(page)
}

async function waitForEditorReady(page: Page) {
  await expect(page.locator('.tab.active', { hasText: 'Research Plan' })).toBeVisible({
    timeout: 30_000,
  })
  await waitForMonacoPainted(page)
}

async function waitForInspectorReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Note Health' })).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.job-progress').getByText('100%')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.widget-action')).toHaveText('Good', { timeout: 45_000 })
  await expect(page.locator('.metric-grid')).toContainText('2', { timeout: 30_000 })
}

async function waitForWorkspace(page: Page) {
  await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
  await expect(page.locator('small.vault-badge', { hasText: 'Research Vault' })).toBeVisible({
    timeout: 45_000,
  })
  await waitForVaultSidebarReady(page)
  await waitForEditorReady(page)
  await waitForInspectorReady(page)
  await settleLayout(page)
}

async function waitForPreviewReady(page: Page) {
  await expect(page.locator('.markdown-preview h1')).toContainText('Research Plan', {
    timeout: 30_000,
  })
  await expect(page.locator('.preview-error')).toHaveCount(0)
  await settleLayout(page)
}

async function waitForGraphReady(page: Page) {
  await expect(page.locator('.graph-canvas.force circle')).toHaveCount(3, { timeout: 20_000 })
  await page.waitForTimeout(1200)
}

async function waitForSettingsReady(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('dd').first()).not.toHaveText('Checking…', { timeout: 20_000 })
  await expect(dialog.getByText('3.1.11')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
}

async function ensureCleanStatusDock(page: Page) {
  const problemsTab = page.getByRole('tab', { name: /Problems/ })
  if (await problemsTab.getAttribute('aria-selected')) {
    await page.getByRole('tab', { name: 'Output' }).click()
  }
  await expect(page.locator('.diagnostics-panel')).toHaveCount(0)
}

test.beforeAll(() => {
  mkdirSync(outputDir, { recursive: true })
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript((chromePrefs) => {
    window.localStorage.setItem('scriptor:app-theme', 'light')
    window.localStorage.setItem('scriptor:editor-mode', 'monaco')
    window.localStorage.setItem('scriptor:editor-theme', 'light')
    window.localStorage.setItem('scriptor:headless-engine', 'false')
    window.localStorage.setItem('scriptor:workspace-mode', 'writing')
    window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
    window.localStorage.setItem('scriptor:split-preview', 'false')
    window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
  }, WORKSPACE_CHROME_PREFS)
})

async function setEditorSurfaceMode(page: Page, mode: 'Source' | 'Split' | 'Preview') {
  await page.locator('.editor-toolbar').getByRole('button', { name: mode, exact: true }).click()
}

test('capture documentation screenshots', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForWorkspace(page)
  await ensureCleanStatusDock(page)

  await setEditorSurfaceMode(page, 'Split')
  await waitForPreviewReady(page)
  await page.screenshot({ path: shotPath('editor-preview'), fullPage: false })

  await setEditorSurfaceMode(page, 'Source')
  await waitForEditorReady(page)
  await page.getByRole('tab', { name: 'Inspector' }).click()
  await waitForInspectorReady(page)
  await settleLayout(page)
  await page.screenshot({ path: shotPath('workspace'), fullPage: false })

  await page.locator('.top-actions').getByRole('button', { name: 'Graph', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Knowledge graph' })).toBeVisible()
  await waitForGraphReady(page)
  await page.screenshot({ path: shotPath('graph'), fullPage: false })

  await page.getByRole('button', { name: 'Close graph' }).click()
  await page.getByRole('tab', { name: 'Plugins' }).click()
  await expect(page.getByRole('heading', { name: 'Plugin marketplace' })).toBeVisible()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath('plugins'), fullPage: false })

  await page.getByLabel('Command or search').click()
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: shotPath('command-palette'), fullPage: false })
  await page.getByRole('button', { name: 'Close command palette' }).click()

  await page.locator('.top-actions').getByRole('button', { name: 'Portal', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Portal' })).toBeVisible()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath('portal'), fullPage: false })
  await page.getByRole('button', { name: 'Close Portal' }).click()

  await page.locator('.top-actions').getByRole('button', { name: 'Workbench', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Knowledge workbench' })).toBeVisible()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath('knowledge-workbench'), fullPage: false })
  await page.getByRole('button', { name: 'Close Knowledge workbench' }).click()

  await page.locator('.top-actions').getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Publish center' })).toBeVisible()
  await page.waitForTimeout(800)
  await page.screenshot({ path: shotPath('publish-center'), fullPage: false })
  await page.getByRole('button', { name: 'Close Publish center' }).click()

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  await waitForSettingsReady(page)
  await page.screenshot({ path: shotPath('settings'), fullPage: false })
})
