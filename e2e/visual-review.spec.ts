import { expect, test, type Page } from '@playwright/test'

import { settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

const RESOURCE_INVENTORY_FIXTURE = {
  generatedAtMs: 1786200000000,
  fingerprint: 'e2e-resource-inventory',
  targets: [
    {
      id: 'codex',
      label: 'Codex CLI',
      kind: 'cli',
      supportLevel: 'native',
      status: 'confirmed',
      evidence: [
        {
          kind: 'config_root',
          path: 'C:/Users/e2e/.codex/skills',
          exists: true,
          resourceCount: 1,
        },
      ],
      installations: [
        {
          id: 'codex-installation',
          identityKind: 'executable',
          path: 'C:/Tools/codex.exe',
          version: '1.0.0-e2e',
          sha256: 'codex-e2e-sha256',
        },
      ],
      resourceRoots: ['C:/Users/e2e/.codex/skills'],
    },
  ],
  resources: [
    {
      id: 'skill-codex-visual-review',
      logicalId: 'skill:visual-review',
      name: 'visual-review',
      kind: 'skill',
      targetId: 'codex',
      scope: 'user',
      path: 'C:/Users/e2e/.codex/skills/visual-review',
      manifestPath: 'C:/Users/e2e/.codex/skills/visual-review/SKILL.md',
      contentHash: '0123456789abcdef0123456789abcdef',
      managed: true,
      symlinked: false,
      valid: true,
      issues: [],
    },
  ],
  duplicates: [],
}

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
  await expect(page.locator('.widget-action')).toHaveText('Good', { timeout: 45_000 })
  await expect(page.locator('.metric-grid')).toContainText('2', { timeout: 30_000 })
  await settleLayout(page)
}

async function waitForVisualWorkspace(page: Page) {
  await waitForWorkspace(page)
  await waitForInspectorReady(page)
  await expect(page.locator('.job-progress')).toHaveAttribute('aria-label', 'Building graph 100%', { timeout: 45_000 })
  await expect(page.locator('.job-progress strong')).toHaveText('Index ready')
  await waitForActiveSplitPreview(page)
}

async function waitForPreviewReady(page: Page) {
  const preview = page.getByRole('article', { name: 'Markdown preview' })
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await expect(preview.getByRole('heading', { name: 'Research Plan', level: 1 })).toBeVisible()
  await expect(page.locator('.preview-error')).toHaveCount(0)
  await settleLayout(page)
}

async function waitForActiveSplitPreview(page: Page) {
  const splitPreview = page.getByRole('article', { name: 'Markdown preview' })
  if (await splitPreview.isVisible()) await waitForPreviewReady(page)
}

async function captureVisual(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name), fullPage: false })
}

async function openVisualWorkspace(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForVisualWorkspace(page)
}

async function expectFullyInViewport(page: Page, selector: string) {
  await expect.poll(
    () => page.locator(selector).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
    }),
    { timeout: 10_000 },
  ).toBe(true)
}

async function openMobileWorkspace(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForEditorReady(page)
  await waitForActiveSplitPreview(page)
  const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
  await expect(nav).toBeVisible()
  await expect(nav).toBeInViewport()
  await expectFullyInViewport(page, 'nav[aria-label="Mobile workspace navigation"]')
}

async function installResourceInventoryFixture(page: Page) {
  await page.evaluate((inventory) => {
    const internals = (window as Window & {
      __TAURI_INTERNALS__?: {
        invoke?: (command: string, payload?: unknown, options?: unknown) => Promise<unknown>
      }
    }).__TAURI_INTERNALS__
    if (!internals?.invoke) throw new Error('E2E Tauri invoke bridge is unavailable')

    const originalInvoke = internals.invoke.bind(internals)
    internals.invoke = async (command, payload, options) => {
      if (command === 'resource_inventory') return inventory
      return originalInvoke(command, payload, options)
    }
  }, RESOURCE_INVENTORY_FIXTURE)
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
      window.localStorage.setItem('scriptor:mobile-pane', 'editor')
      window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
      window.localStorage.setItem('scriptor:split-preview', 'false')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
    }, WORKSPACE_CHROME_PREFS)
  })

  test('inspector preview mode', async ({ page }) => {
    await openVisualWorkspace(page)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
    const inspector = page.getByRole('complementary', { name: 'Inspector' })
    await expect(inspector.getByRole('tab', { name: 'Preview', selected: true })).toBeVisible()
    await waitForPreviewReady(page)
    await expect(inspector.getByRole('heading', { name: 'Research Plan', level: 1 })).toBeVisible()
    await captureVisual(page, 'visual-inspector-preview.png')
  })

  test('dark workspace with split preview', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
    })
    await openVisualWorkspace(page)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()
    await waitForPreviewReady(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await captureVisual(page, 'visual-editor-split-dark.png')
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
      await menu.screenshot({ path: test.info().outputPath(`visual-${menuName.toLowerCase()}-popover.png`) })
    })
  }

  test('MCP sharing and sync inventory', async ({ page }) => {
    await openVisualWorkspace(page)
    await installResourceInventoryFixture(page)
    const mcpButton = page.locator('.top-actions button').filter({ hasText: /MCP|Read-only|Write/i })
    await mcpButton.click()
    const mcpPanel = page.getByRole('dialog', { name: /MCP|automation/i })
    await expect(mcpPanel).toBeVisible()
    await mcpPanel.getByRole('tab', { name: 'Sharing & sync' }).click()

    const sharing = mcpPanel.getByRole('region', { name: 'Sharing and sync' })
    await expect(sharing).toBeVisible()
    await expect(sharing.getByRole('heading', { name: 'Sharing and sync' })).toBeVisible()
    await expect(sharing).toContainText('Codex CLI')
    await expect(sharing).toContainText('visual-review')
    await settleLayout(page)

    await mcpPanel.screenshot({ path: test.info().outputPath('visual-mcp-sharing-inventory.png') })
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
    await fallback.locator(':scope > div').screenshot({ path: test.info().outputPath('visual-editor-recovery.png') })
  })

  test('workspace at 1024px breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForVisualWorkspace(page)

    const editor = page.getByRole('region', { name: 'Editor' })
    await expect(editor).toBeInViewport()
    await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(280)
    await expect(page.getByRole('complementary', { name: 'Vault' })).toBeInViewport()

    await captureVisual(page, 'visual-workspace-tablet-1024.png')
  })

  test('compact mobile editor pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await expect(nav.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.editor-panel')).toBeInViewport()

    await captureVisual(page, 'visual-mobile-editor-390.png')
  })

  test('compact mobile vault pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await nav.getByRole('button', { name: 'Vault' }).click()
    await expect(nav.getByRole('button', { name: 'Vault' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' })).toBeVisible()
    await expect(page.locator('.vault-panel')).toBeInViewport()
    await settleLayout(page)

    await captureVisual(page, 'visual-mobile-vault-390.png')
  })

  test('compact mobile inspector pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await nav.getByRole('button', { name: 'Lens' }).click()
    await expect(nav.getByRole('button', { name: 'Lens' })).toHaveAttribute('aria-current', 'page')
    await waitForInspectorReady(page)
    await expect(page.locator('.inspector-panel')).toBeInViewport()

    await captureVisual(page, 'visual-mobile-inspector-390.png')
  })
})
