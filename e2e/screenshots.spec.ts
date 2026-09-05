import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

import { captureReadyScreenshot, settleLayout, WORKSPACE_CHROME_PREFS } from './helpers.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(rootDir, 'docs/assets/screenshots')

function shotPath(name: string) {
  return path.join(outputDir, `${name}.png`)
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
  await expect(page.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible({
    timeout: 30_000,
  })
  await waitForMonacoPainted(page)
}

async function waitForInspectorReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Note Health' })).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.widget-action')).toHaveText('Good', { timeout: 45_000 })
  await expect(page.locator('.metric-grid')).toContainText('2', { timeout: 30_000 })
}

async function waitForFullWorkspace(page: Page) {
  await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
  await expect(page.locator('small.vault-badge', { hasText: 'Research Vault' })).toBeVisible({
    timeout: 45_000,
  })
  await waitForVaultSidebarReady(page)
  await waitForEditorReady(page)
  await waitForInspectorReady(page)
  await expect(page.locator('.job-progress')).toHaveAttribute('aria-label', 'Index ready (100%)', { timeout: 45_000 })
  await expect(page.locator('.job-progress strong')).toHaveText('Index ready')
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
  await expect(dialog.locator('dd').first()).not.toHaveText('Checking...', { timeout: 20_000 })
  // Version-agnostic: assert a resolved semver-ish version is rendered rather
  // than pinning a literal that breaks on every Pandoc/app version bump.
  await expect(dialog.getByText(/^\d+\.\d+(\.\d+)*$/).first()).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
}

async function openCommandPaletteForShot(page: Page) {
  // The palette trigger lives in the topbar and is re-rendered while the
  // workspace hydrates; assert it is actually actionable before clicking, then
  // wait for the dialog *and* its searchbox so downstream interactions never
  // race the mount animation.
  const trigger = page.getByRole('button', { name: /Open command palette/i })
  await expect(trigger).toBeVisible({ timeout: 30_000 })
  await expect(trigger).toBeEnabled({ timeout: 30_000 })
  await trigger.click()
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible({ timeout: 30_000 })
  const searchbox = palette.getByRole('searchbox')
  await expect(searchbox).toBeVisible({ timeout: 30_000 })
  return palette
}

async function ensureCleanStatusDock(page: Page) {
  const selectedTab = page.locator('.bottom-tabs [role="tab"][aria-selected="true"]')
  if ((await selectedTab.getAttribute('aria-expanded')) === 'true') {
    await selectedTab.click()
  }
  await expect(page.locator('.diagnostics-panel')).toHaveCount(0)
  await expect(page.locator('.dock-panel')).toHaveCount(0)
}

async function setEditorSurfaceMode(page: Page, mode: 'Source' | 'Split' | 'Preview') {
  await page.locator('.editor-toolbar').getByRole('button', { name: mode, exact: true }).click()
}

// ── Setup ────────────────────────────────────────────────────────────────────

test.beforeAll(() => {
  mkdirSync(outputDir, { recursive: true })
})

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message))
  page.on('response', response => {
    if (response.status() === 404) {
      console.error(`404 NOT FOUND: ${response.url()}`)
    }
  })
  await page.addInitScript((chromePrefs) => {
    window.localStorage.setItem('scriptor:app-theme', 'light')
    window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    window.localStorage.setItem('scriptor:editor-mode', 'monaco')
    window.localStorage.setItem('scriptor:editor-theme', 'light')
    window.localStorage.setItem('scriptor:headless-engine', 'false')
    window.localStorage.setItem('scriptor:workspace-mode', 'writing')
    window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
    window.localStorage.setItem('scriptor:split-preview', 'false')
    // Baselines capture the full status dock; the app default is collapsed.
    window.localStorage.setItem('scriptor:status-dock-collapsed', 'false')
    window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
  }, WORKSPACE_CHROME_PREFS)
})

// ── Screenshot tests ─────────────────────────────────────────────────────────

// Baselines are captured on the pinned Windows CI runner; keep seeded workspace chrome preferences aligned with them.

test('main workspace — light mode', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await ensureCleanStatusDock(page)
  await captureReadyScreenshot(page, shotPath('workspace-light'))
  await expect(page).toHaveScreenshot('workspace-light.png', { fullPage: false })
})

test('main workspace — dark mode', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('scriptor:app-theme', 'dark')
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await ensureCleanStatusDock(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await captureReadyScreenshot(page, shotPath('workspace-dark'))
  await expect(page).toHaveScreenshot('workspace-dark.png', { fullPage: false })
})

test('editor with split preview', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await ensureCleanStatusDock(page)
  await setEditorSurfaceMode(page, 'Split')
  await waitForPreviewReady(page)
  await captureReadyScreenshot(page, shotPath('editor-preview'))
  await expect(page).toHaveScreenshot('editor-preview.png', { fullPage: false })
})

test('inspector preview', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  const splitToggle = page.getByRole('button', { name: 'Toggle split preview' })
  if ((await splitToggle.getAttribute('aria-pressed')) === 'true') await splitToggle.click()
  await page.getByRole('tab', { name: 'Preview' }).click()
  await waitForPreviewReady(page)
  await captureReadyScreenshot(page, shotPath('inspector-preview'))
  await expect(page).toHaveScreenshot('inspector-preview.png', { fullPage: false })
})

test('command palette', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await openCommandPaletteForShot(page)
  await settleLayout(page)
  await captureReadyScreenshot(page, shotPath('command-palette'))
  await expect(page).toHaveScreenshot('command-palette.png', { fullPage: false })
})

test('graph panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions').getByRole('button', { name: 'Graph', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Knowledge graph' })).toBeVisible()
  await waitForGraphReady(page)
  await captureReadyScreenshot(page, shotPath('graph'))
  await expect(page).toHaveScreenshot('graph.png', { fullPage: false })
})

test('canvas panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions').getByRole('button', { name: 'Canvas', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Canvas' })).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await captureReadyScreenshot(page, shotPath('canvas'))
  await expect(page).toHaveScreenshot('canvas.png', { fullPage: false })
})

test('git panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions .status-button').first().click()
  const gitPanel = page.locator('.git-panel')
  await expect(gitPanel).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await captureReadyScreenshot(page, shotPath('git-panel'))
  await expect(page).toHaveScreenshot('git-panel.png', { fullPage: false })
})

test('mcp panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  const mcpButton = page.locator('.top-actions').getByRole('button', { name: /MCP|Read-only|Write/i })
  await mcpButton.click()
  const mcpPanel = page.locator('.mcp-panel')
  await expect(mcpPanel).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await captureReadyScreenshot(page, shotPath('mcp-panel'))
  await expect(page).toHaveScreenshot('mcp-panel.png', { fullPage: false })
})

test('settings panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  await waitForSettingsReady(page)
  await captureReadyScreenshot(page, shotPath('settings'))
  await expect(page).toHaveScreenshot('settings.png', { fullPage: false })
})

test('publish center', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions').getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Publish center' })).toBeVisible()
  await page.waitForTimeout(800)
  await captureReadyScreenshot(page, shotPath('publish-center'))
  await expect(page).toHaveScreenshot('publish-center.png', { fullPage: false })
})

test('vault health dashboard', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions').getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Publish center' })).toBeVisible()
  await page.getByRole('button', { name: 'Close Publish center' }).click()
  await page.locator('.widget-action').getByText('Good').click()
  const healthDashboard = page.getByRole('dialog', { name: 'Vault health' })
  await expect(healthDashboard).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(800)
  await captureReadyScreenshot(page, shotPath('vault-health'))
  await expect(page).toHaveScreenshot('vault-health.png', { fullPage: false })
})

test('knowledge workbench', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions').getByRole('button', { name: 'Workbench', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Knowledge workbench' })).toBeVisible()
  await page.waitForTimeout(800)
  await captureReadyScreenshot(page, shotPath('knowledge-workbench'))
  await expect(page).toHaveScreenshot('knowledge-workbench.png', { fullPage: false })
})

test('conflict resolver modal', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('e2e:git-conflicts', '1')
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('.top-actions .status-button').first().click()
  const gitPanel = page.locator('.git-panel')
  await expect(gitPanel).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  const resolveBtn = gitPanel.getByRole('button', { name: /resolve/i }).first()
  if (await resolveBtn.isVisible()) {
    await resolveBtn.click()
  } else {
    await gitPanel.locator('.conflict-resolve-btn, [title*="conflict"], [title*="Resolve"]').first().click()
  }
  const resolver = page.getByRole('dialog', { name: 'Resolve merge conflict' })
  await expect(resolver).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(500)
  await captureReadyScreenshot(page, shotPath('conflict-resolver'))
  await expect(page).toHaveScreenshot('conflict-resolver.png', { fullPage: false })
})

test('note history panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  const palette = await openCommandPaletteForShot(page)
  await palette.getByRole('searchbox').fill('Note history')
  const historyOption = palette.getByRole('option', { name: 'Note history timeline' })
  await expect(historyOption).toBeVisible({ timeout: 15_000 })
  await historyOption.click()
  const historyPanel = page.getByRole('dialog', { name: 'Note history' })
  await expect(historyPanel).toBeVisible()
  await expect(historyPanel.getByText(/words/)).toBeVisible()
  await settleLayout(page)
  await captureReadyScreenshot(page, shotPath('note-history'))
  await expect(page).toHaveScreenshot('note-history.png', { fullPage: false })
})

test('keyboard shortcut editor', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  await waitForSettingsReady(page)
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const shortcutsTab = settings.getByRole('tab', { name: /Keyboard|Shortcuts/i })
  if (await shortcutsTab.isVisible()) {
    await shortcutsTab.click()
    await page.waitForTimeout(500)
  }
  await captureReadyScreenshot(page, shotPath('keyboard-shortcuts'))
  await expect(page).toHaveScreenshot('keyboard-shortcuts.png', { fullPage: false })
})

test('mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1024 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForEditorReady(page)
  await waitForPreviewReady(page)
  const mobileNav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
  await expect(mobileNav).toBeVisible()
  await expect(mobileNav).toBeInViewport()
  await captureReadyScreenshot(page, shotPath('workspace-mobile'))
})

test('tablet workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await ensureCleanStatusDock(page)
  await captureReadyScreenshot(page, shotPath('workspace-tablet'))
})

test('compact mobile vault and inspector panes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForEditorReady(page)
  const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
  await expect(nav).toBeVisible()

  await nav.getByRole('button', { name: 'Vault' }).click()
  await expect(page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' })).toBeVisible()
  await captureReadyScreenshot(page, shotPath('mobile-vault'))

  await nav.getByRole('button', { name: 'Lens' }).click()
  await waitForInspectorReady(page)
  await expect(page.locator('.inspector-panel')).toBeInViewport()
  await captureReadyScreenshot(page, shotPath('mobile-inspector'))
})

test('onboarding tour', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('scriptor:onboarding-complete')
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  const tour = page.getByRole('dialog', { name: 'Product tour' })
  await expect(tour).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(500)
  await captureReadyScreenshot(page, shotPath('onboarding-tour'))
  await expect(page).toHaveScreenshot('onboarding-tour.png', { fullPage: false })
})

test('plugins panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForFullWorkspace(page)
  await page.getByRole('tab', { name: 'Plugins' }).click()
  await expect(page.getByRole('heading', { name: 'Plugin marketplace' })).toBeVisible()
  await page.waitForTimeout(800)
  await captureReadyScreenshot(page, shotPath('plugins'))
  await expect(page).toHaveScreenshot('plugins.png', { fullPage: false })
})
