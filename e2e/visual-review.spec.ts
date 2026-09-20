import { expect, test, type Page } from '@playwright/test'

import { openCommandPalette, runCommand, settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

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
  const inspector = page.locator('.inspector-panel')
  await expect(inspector).toBeVisible({ timeout: 45_000 })
  await expect(inspector.locator('.widget-action').first()).toBeVisible({ timeout: 45_000 })
  await expect(inspector.locator('.metric-grid')).toContainText('2', { timeout: 30_000 })
  await settleLayout(page)
}

async function waitForVisualWorkspace(page: Page) {
  await waitForWorkspace(page)
  await waitForInspectorReady(page)
  const progress = page.locator('.job-progress')
  await expect(progress).toHaveClass(/is-done/, { timeout: 45_000 })
  await expect(progress).toHaveAttribute('aria-label', /\S/, { timeout: 45_000 })
  await expect(progress.locator('strong')).toBeVisible()
  await waitForActiveSplitPreview(page)
}

async function waitForPreviewReady(page: Page) {
  const preview = page.getByRole('article', { name: 'Markdown preview' }).first()
  await expect(preview).toBeVisible({ timeout: 30_000 })
  await expect(preview.getByRole('heading', { name: 'Research Plan', level: 1 })).toBeVisible()
  await expect(page.locator('.preview-error')).toHaveCount(0)
  await settleLayout(page)
}

async function waitForActiveSplitPreview(page: Page) {
  const splitPreview = page.getByRole('article', { name: 'Markdown preview' }).first()
  if (await splitPreview.isVisible()) await waitForPreviewReady(page)
}

async function captureVisual(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name), fullPage: false })
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.clientWidth)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
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
      window.localStorage.setItem('scriptor:headless-engine', 'false')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:mobile-pane', 'editor')
      window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
      window.localStorage.setItem('scriptor:split-preview', 'false')
      // Baselines capture the full status dock; the app default is collapsed.
      window.localStorage.setItem('scriptor:status-dock-collapsed', 'false')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
    }, WORKSPACE_CHROME_PREFS)
  })

  test('dark workspace with split preview', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
    })
    await openVisualWorkspace(page)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()
    await waitForPreviewReady(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect
      .poll(() =>
        page.locator('.monaco-editor').evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe('rgb(15, 23, 42)')

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
    await openCommandPalette(page)
    await runCommand(page, 'Open MCP panel')
    const mcpPanel = page.locator('.mcp-panel')
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
    await expect(fallback.getByRole('button', { name: 'Switch to CodeMirror' })).toBeFocused()
    await fallback.locator(':scope > div').screenshot({ path: test.info().outputPath('visual-editor-recovery.png') })
  })

  test('compact mobile editor pane', async ({ page }) => {
    await openMobileWorkspace(page)
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await expect(nav.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.editor-panel')).toBeInViewport()

    await captureVisual(page, 'visual-mobile-editor-390.png')
  })

  test('dense graph canvas evidence', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:dense-graph', '1')
    })
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')

    const graph = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(graph).toBeVisible()
    await expect(graph.locator('.graph-header')).toContainText('120 nodes')
    const stage = graph.locator('.graph-stage')
    const canvas = graph.locator('.graph-canvas-accessible-shell canvas')
    await expect(stage).toBeVisible()
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await expect(canvas).toHaveAttribute('aria-label', /120 nodes and 160 directed edges/)
    const geometry = await stage.evaluate((element) => {
      const canvas = element.querySelector('canvas')
      if (!canvas) return null
      const stageRect = element.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      return {
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
      }
    })
    expect(geometry).not.toBeNull()
    expect(geometry?.stageWidth ?? 0).toBeGreaterThan(900)
    expect(geometry?.stageHeight ?? 0).toBeGreaterThan(360)
    expect(Math.abs((geometry?.canvasWidth ?? 0) - (geometry?.stageWidth ?? 0))).toBeLessThanOrEqual(2)
    expect(Math.abs((geometry?.canvasHeight ?? 0) - (geometry?.stageHeight ?? 0))).toBeLessThanOrEqual(2)
    await expectNoHorizontalOverflow(page)
    await graph.screenshot({ path: test.info().outputPath('visual-graph-dense-120.png') })
  })

  test('populated canvas board', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open canvas')

    const canvas = page.getByRole('dialog', { name: 'Canvas board' })
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await canvas.getByRole('button', { name: 'Add first card' }).click()
    await expect(canvas.locator('.canvas-block')).toHaveCount(1)

    const linkActiveNote = canvas.getByRole('button', { name: 'Link to active note' })
    await expect(linkActiveNote).toBeEnabled()
    await linkActiveNote.click()
    await expect(canvas.locator('.canvas-block')).toHaveCount(1)
    await expect(canvas.locator('.canvas-header')).toContainText('1 block')
    await expect(canvas.locator('.canvas-footer')).toContainText('Linked 1 block(s) to Research Plan.md')
    const stageSvg = canvas.locator('.canvas-svg')
    await expect(stageSvg.locator(':scope > rect')).toHaveCount(0)
    await expect.poll(() => stageSvg.evaluate((element) => getComputedStyle(element).backgroundColor !== 'rgba(0, 0, 0, 0)')).toBe(true)
    await settleLayout(page)

    await canvas.screenshot({ path: test.info().outputPath('visual-canvas-populated.png') })
  })

  test('populated knowledge workbench triage', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:knowledge-repair-notes', '1')
    })
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open knowledge workbench')

    const workbench = page.getByRole('dialog', { name: 'Knowledge workbench' })
    await expect(workbench).toBeVisible()
    const orphanTab = workbench.getByRole('tab', { name: /Orphans \(3\)/ })
    await orphanTab.click()
    const rows = workbench.locator('.virtual-knowledge-list > li')
    await expect(rows).toHaveCount(3)
    await expect(
      workbench.getByText('Field Notes with an intentionally long title for zoom coverage', { exact: true }),
    ).toBeVisible()

    await workbench.getByRole('button', { name: /Start triage/ }).click()
    await expect(workbench.getByText(/Triage 1 of 3/)).toBeVisible()
    await settleLayout(page)

    await workbench.screenshot({ path: test.info().outputPath('visual-knowledge-triage-populated.png') })
  })

  test('Help stays centralized while F1 remains contextual', async ({ page }) => {
    await openVisualWorkspace(page)
    await expect(page.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
    await expect(page.locator('header.topbar').getByRole('button', { name: 'Help & guides', exact: true })).toBeVisible()
    await captureVisual(page, 'visual-help-restraint.png')

    await openCommandPalette(page)
    await runCommand(page, 'Open MCP panel')
    const mcp = page.locator('.mcp-panel')
    await expect(mcp).toBeVisible()
    await expect(mcp.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
    await mcp.getByRole('tab', { name: 'Audit', exact: true }).focus()
    await page.keyboard.press('F1')

    const help = page.getByRole('dialog', { name: 'Help & guides', exact: true })
    await expect(help).toBeVisible()
    await expect(help.getByRole('heading', { name: 'MCP automation modes and tools', exact: true })).toBeVisible()
    await expect(help.locator('.help-center-body')).toHaveCSS('display', 'grid')
    await expect(help.locator('.help-browser')).toHaveCSS('overflow-y', 'auto')
    await expect.poll(() => help.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    const idleBrowseCount = await help.locator('.help-browser nav li').count()
    expect(idleBrowseCount).toBeGreaterThan(1)
    expect(idleBrowseCount).toBeLessThanOrEqual(10)
    await expect(help).not.toContainText('Matching guides: 78')
    await settleLayout(page)
    await help.screenshot({ path: test.info().outputPath('visual-help-mcp-guide.png') })
  })

  test('high-contrast workspace evidence', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'high-contrast')
    })
    await openVisualWorkspace(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast')
    await expectNoHorizontalOverflow(page)
    await expect(page.locator('.editor-panel')).toBeVisible()
    await expect(page.locator('.inspector-panel')).toBeVisible()
    await captureVisual(page, 'visual-workspace-high-contrast.png')
  })

  test('mobile Help remains styled, bounded, and centralized', async ({ page }) => {
    await openMobileWorkspace(page)
    await expect(page.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
    await page.keyboard.press('F1')
    const help = page.getByRole('dialog', { name: 'Help & guides', exact: true })
    await expect(help).toBeVisible()
    await expect(help.locator('.help-center-body')).toHaveCSS('display', 'flex')
    await expect(help.locator('.help-browser')).toHaveCSS('display', 'grid')
    await expect.poll(() => help.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left >= 0
        && rect.top >= 0
        && rect.right <= window.innerWidth
        && rect.bottom <= window.innerHeight
        && element.scrollWidth <= element.clientWidth + 1
    })).toBe(true)
    await help.screenshot({ path: test.info().outputPath('visual-help-mobile-390.png') })
  })

  test('Persian RTL workspace evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'fa')
    })
    await openVisualWorkspace(page)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expectNoHorizontalOverflow(page)
    await captureVisual(page, 'visual-workspace-rtl-fa.png')
  })

  test('German compact workspace evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'de')
    })
    await openVisualWorkspace(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    const toolbar = page.locator('.editor-toolbar')
    const rowTops = await toolbar.locator(':scope > .format-group').evaluateAll((groups) =>
      groups.map((group) => Math.round(group.getBoundingClientRect().top)),
    )
    expect(new Set(rowTops).size).toBe(1)
    await expectNoHorizontalOverflow(page)
    await captureVisual(page, 'visual-workspace-de-1024.png')
  })

  test('125 percent UI zoom evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:ui-zoom', '1.25')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    await waitForEditorReady(page)
    await settleLayout(page)
    await expect(page.locator('html')).toHaveAttribute('data-ui-reflow', 'stacked')
    await expectNoHorizontalOverflow(page)
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(editor).not.toBeNull()
    expect(editor?.width ?? 0).toBeGreaterThan(240)
    await captureVisual(page, 'visual-workspace-ui-zoom-125.png')
  })

  test('200 percent UI zoom evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:ui-zoom', '2')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page, { allowHiddenVaultList: true })
    await waitForEditorReady(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('data-ui-reflow', 'mobile')
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await expect(nav).toBeVisible()
    await expect(page.locator('.status-strip')).toBeHidden()
    await expect(page.locator('.workspace-mode-select')).toBeVisible()
    const modeButtons = page.locator('.workspace-mode-strip .workspace-mode')
    await expect(modeButtons).toHaveCount(5)
    await expect.poll(() => modeButtons.evaluateAll((buttons) =>
      buttons.every((button) => button.getClientRects().length === 0 || getComputedStyle(button).display === 'none'),
    )).toBe(true)
    await expect(page.locator('.editor-panel')).toBeVisible()
    await expect(page.locator('.inspector-panel')).toBeHidden()
    await expect.poll(() => page.locator('header.topbar').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await expect(page.locator('.command-search')).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    await captureVisual(page, 'visual-workspace-ui-zoom-200-editor.png')

    await nav.getByRole('button', { name: 'Lens' }).click()
    await expect(page.locator('.editor-panel')).toBeHidden()
    await expect(page.locator('.inspector-panel')).toBeVisible()
    await expect(page.locator('.inspector-panel')).toBeInViewport()
    await expectNoHorizontalOverflow(page)
    await captureVisual(page, 'visual-workspace-ui-zoom-200-inspector.png')
  })

  test('125 percent device scale evidence', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: String(testInfo.project.use.baseURL),
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.25,
    })
    const scaledPage = await context.newPage()
    try {
      await scaledPage.addInitScript((chromePrefs) => {
        window.localStorage.setItem('scriptor:app-theme', 'light')
        window.localStorage.setItem('scriptor:onboarding-complete', 'true')
        window.localStorage.setItem('scriptor:editor-mode', 'monaco')
        window.localStorage.setItem('scriptor:headless-engine', 'false')
        window.localStorage.setItem('scriptor:workspace-mode', 'writing')
        window.localStorage.setItem('scriptor:mobile-pane', 'editor')
        window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
        window.localStorage.setItem('scriptor:split-preview', 'false')
        window.localStorage.setItem('scriptor:status-dock-collapsed', 'false')
        window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
      }, WORKSPACE_CHROME_PREFS)
      await scaledPage.goto('/', { waitUntil: 'domcontentloaded' })
      await waitForVisualWorkspace(scaledPage)
      await expectNoHorizontalOverflow(scaledPage)
      const editor = await scaledPage.locator('.editor-panel').boundingBox()
      expect(editor).not.toBeNull()
      expect(editor?.width ?? 0).toBeGreaterThan(300)
      await scaledPage.screenshot({
        path: test.info().outputPath('visual-workspace-device-scale-125.png'),
        fullPage: false,
      })
    } finally {
      await context.close()
    }
  })

  test('slow vault loading evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:slow-vault', '1')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vault-skeleton-row').first()).toBeVisible({ timeout: 5_000 })
    await expectNoHorizontalOverflow(page)
    await captureVisual(page, 'visual-vault-loading.png')
    await waitForWorkspace(page)
    await expect(page.locator('.vault-skeleton-row')).toHaveCount(0)
  })

  test('large vault virtualization evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:large-vault', '1')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    await waitForInspectorReady(page)
    const list = page.locator('.virtual-note-list')
    await expect(list).toBeVisible()
    expect(await list.locator(':scope > li').count()).toBeLessThan(80)
    await list.evaluate((element) => {
      const scroller = element.parentElement
      if (!scroller) throw new Error('virtual note list scroll container missing')
      scroller.scrollTop = scroller.scrollHeight
      scroller.dispatchEvent(new Event('scroll'))
    })
    await expect(
      list.getByRole('button', {
        name: 'Generated research note 0600 with an intentionally long filename for truncation and virtualization coverage.md',
      }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await captureVisual(page, 'visual-large-vault-bottom.png')
  })

  test('narrow inspector health metrics remain readable at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await openVisualWorkspace(page)

    const inspector = page.locator('.inspector-panel')
    await expect(inspector).toBeVisible()
    const grid = inspector.locator('.metric-grid').first()
    await expect(grid).toBeVisible()
    const geometry = await grid.evaluate((element) => {
      const cards = Array.from(element.querySelectorAll<HTMLElement>('.metric'))
      const columns = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)))
      return {
        columns: columns.size,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        cardsFit: cards.every((card) => card.scrollWidth <= card.clientWidth + 1),
      }
    })
    expect(geometry.columns).toBeLessThanOrEqual(2)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
    expect(geometry.cardsFit).toBe(true)
    await inspector.screenshot({ path: test.info().outputPath('visual-inspector-metrics-1024.png') })
  })

  test('status dock Problems and Output states stay bounded', async ({ page }) => {
    await openVisualWorkspace(page)

    const problemsTab = page.getByRole('tab', { name: /Problems/ }).first()
    if ((await problemsTab.getAttribute('aria-expanded')) !== 'true') {
      await problemsTab.click()
    }
    const problems = page.locator('#dock-panel-problems')
    await expect(problems).toBeVisible()
    const editorLintHeader = problems.locator('.diagnostics-section-header').filter({ hasText: 'Editor lint' })
    const linkReferenceAction = editorLintHeader.getByRole('button', { name: 'Generate link references' })
    await expect(linkReferenceAction).toBeVisible()
    const diagnosticsGeometry = await editorLintHeader.evaluate((header) => {
      const heading = header.querySelector('h3')
      const action = header.querySelector('button')
      if (!heading || !action) return null
      const headerRect = header.getBoundingClientRect()
      const headingRect = heading.getBoundingClientRect()
      const actionRect = action.getBoundingClientRect()
      return {
        headerWidth: headerRect.width,
        actionWidth: actionRect.width,
        gap: actionRect.left - headingRect.right,
        headingHeight: headingRect.height,
      }
    })
    expect(diagnosticsGeometry).not.toBeNull()
    expect(diagnosticsGeometry?.actionWidth ?? Infinity).toBeLessThan((diagnosticsGeometry?.headerWidth ?? 0) * 0.5)
    expect(diagnosticsGeometry?.gap ?? -1).toBeGreaterThanOrEqual(8)
    expect(diagnosticsGeometry?.headingHeight ?? Infinity).toBeLessThanOrEqual(32)
    await expectNoHorizontalOverflow(page)
    await problems.screenshot({ path: test.info().outputPath('visual-dock-problems.png') })

    const outputTab = page.getByRole('tab', { name: /^Output/ }).first()
    await outputTab.click()
    const output = page.locator('#dock-panel-output')
    await expect(output).toBeVisible()
    await expect(output).not.toContainText('Could not install close-save guard')
    await expect(output).not.toContainText('currentWindow')
    await expectNoHorizontalOverflow(page)
    await output.screenshot({ path: test.info().outputPath('visual-dock-output.png') })
  })


  test('dark settings surface evidence', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
    })
    await openVisualWorkspace(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await settings.screenshot({ path: test.info().outputPath('visual-settings-dark.png') })
  })

  test('dark conflict resolver evidence', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.sessionStorage.setItem('e2e:git-conflicts', '1')
    })
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open Git panel')
    const git = page.locator('.git-panel')
    await expect(git).toBeVisible()
    await git.getByRole('button', { name: 'Resolve' }).click()
    const resolver = page.getByRole('dialog', { name: 'Resolve merge conflicts' })
    await expect(resolver).toBeVisible()
    await expect(resolver.getByRole('button', { name: 'Apply resolved file' })).toBeDisabled()
    await settleLayout(page)
    await resolver.screenshot({ path: test.info().outputPath('visual-conflict-resolver-dark.png') })
  })


  test('Reader PDF surface evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await page.getByRole('button', { name: 'Research Paper.pdf' }).click()
    const reader = page.locator('.reader-panel')
    await expect(reader).toBeVisible()
    await expect(reader).toContainText('Research Paper.pdf')
    const frame = reader.locator('iframe[title*="Research Paper.pdf"]')
    await expect(frame).toBeVisible()
    await expect(frame.contentFrame().locator('#text-layer')).toContainText('Scriptor Reader')
    await reader.screenshot({ path: test.info().outputPath('visual-reader-pdf.png') })
  })

  test('Tasks panel evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open tasks panel')
    const tasks = page.getByRole('dialog', { name: 'Tasks', exact: true })
    await expect(tasks).toBeVisible()
    await expect(tasks).toContainText('Collect sources')
    await settleLayout(page)
    await tasks.screenshot({ path: test.info().outputPath('visual-tasks-populated.png') })
  })

  test('Kanban board evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await page.getByRole('button', { name: 'Sprint Board.md' }).click()
    await expect(page.getByRole('tab', { name: 'Sprint Board', selected: true })).toBeVisible()
    await openCommandPalette(page)
    await runCommand(page, 'Open kanban board')
    const board = page.getByRole('dialog', { name: 'Sprint Board', exact: true })
    await expect(board).toBeVisible()
    await expect(board).toContainText('Draft release notes')
    await settleLayout(page)
    await board.screenshot({ path: test.info().outputPath('visual-kanban-populated.png') })
  })

  test('Bibliography panel evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Browse bibliography')
    const bibliography = page.getByRole('dialog', { name: 'Bibliography', exact: true })
    await expect(bibliography).toBeVisible()
    await settleLayout(page)
    await bibliography.screenshot({ path: test.info().outputPath('visual-bibliography.png') })
  })

  test('Snippet catalog evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Manage snippet catalog')
    const snippets = page.getByRole('dialog', { name: 'Snippet catalog', exact: true })
    await expect(snippets).toBeVisible()
    await settleLayout(page)
    await snippets.screenshot({ path: test.info().outputPath('visual-snippets.png') })
  })

  test('Markdown cheatsheet evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Markdown cheatsheet')
    const cheatsheet = page.getByRole('dialog', { name: 'Markdown cheatsheet', exact: true })
    await expect(cheatsheet).toBeVisible()
    await cheatsheet.screenshot({ path: test.info().outputPath('visual-cheatsheet.png') })
  })

  test('Template picker evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'New note from template')
    const picker = page.getByRole('dialog', { name: 'Choose template', exact: true })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('option', { name: 'Blank note' })).toBeVisible()
    await picker.screenshot({ path: test.info().outputPath('visual-template-picker.png') })
  })

  test('Obsidian import evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Import Obsidian vault')
    const importer = page.getByRole('dialog', { name: 'Import Obsidian vault', exact: true })
    await expect(importer).toBeVisible()
    await importer.screenshot({ path: test.info().outputPath('visual-obsidian-import.png') })
  })

  test('Support panel evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Support Scriptor')
    const support = page.getByRole('dialog', { name: 'Support Scriptor', exact: true })
    await expect(support).toBeVisible()
    await expect(support).toContainText('Licensed under AGPL-3.0-or-later.')
    await support.screenshot({ path: test.info().outputPath('visual-support.png') })
  })

  test('Portal panel evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open portal clipboard')
    const portal = page.locator('.portal-panel')
    await expect(portal).toBeVisible()
    await portal.screenshot({ path: test.info().outputPath('visual-portal.png') })
  })

  test('Quick capture panel evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Quick capture (scratchpad & todos)')
    const capture = page.locator('.quick-capture-panel')
    await expect(capture).toBeVisible()
    for (const name of ['New inbox note', 'Insert in active', 'Add']) {
      await expect(capture.getByRole('button', { name, exact: true })).toHaveClass(/toolbar-button/)
    }
    await capture.screenshot({ path: test.info().outputPath('visual-quick-capture.png') })
  })

  test('Built-in modules evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open built-in modules')
    const modules = page.getByRole('dialog', { name: 'Built-in modules', exact: true })
    await expect(modules).toBeVisible()
    await expect(modules.getByText('Installer Profile Preset:')).toBeVisible()
    await modules.screenshot({ path: test.info().outputPath('visual-built-in-modules.png') })
  })

  test('Performance HUD evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Show performance HUD')
    const hud = page.locator('.perf-hud-overlay')
    await expect(hud).toBeVisible()
    await expect(hud).toContainText('Vault open')
    await hud.screenshot({ path: test.info().outputPath('visual-performance-hud.png') })
  })

  test('Google integration settings evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await page.locator('header.topbar').getByRole('button', { name: 'Settings', exact: true }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    await settings.getByRole('tab', { name: 'Integrations', exact: true }).click()

    const google = settings.locator('.google-integration-settings')
    await expect(google).toBeVisible()
    await expect(google.locator('h3')).toBeVisible()
    await expect(google).toContainText('Google')
    await expect(google).toContainText('Gmail')
    await expect(google.getByRole('checkbox')).toBeVisible()
    await settleLayout(page)

    await settings.screenshot({ path: test.info().outputPath('visual-settings-integrations-google.png') })
  })

  test('populated Inbox evidence', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:inbox-notes', '1')
    })
    await openVisualWorkspace(page)

    const vault = page.getByRole('complementary', { name: 'Vault' })
    const inboxButton = vault.getByRole('button', { name: /Inbox/ })
    await expect(inboxButton.locator('.inbox-badge')).toHaveText('2')
    await inboxButton.click()

    const inbox = vault.getByRole('region', { name: 'Inbox' })
    await expect(inbox).toBeVisible()
    await expect(inbox).toContainText('Inbox (2)')
    await expect(inbox).toContainText('Research Plan')
    await expect(inbox).toContainText('Field Notes')
    await settleLayout(page)

    await vault.screenshot({ path: test.info().outputPath('visual-inbox-populated.png') })
  })

  test('rename dry-run rewrite evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await page
      .locator('.virtual-note-list')
      .getByRole('button', { name: 'Research Plan.md', exact: true })
      .click({ button: 'right' })
    const rename = page.getByRole('dialog', { name: 'Rename note', exact: true })
    await expect(rename).toBeVisible()
    await rename.getByRole('textbox', { name: 'New filename' }).fill('Research Plan Renamed')
    await rename.getByRole('button', { name: 'Dry run', exact: true }).click()
    const preview = rename.locator('.rename-preview')
    await expect(preview).toContainText('2 link edits across 2 files')
    await expect(preview).toContainText('Field Notes.md')
    await expect(preview).toContainText('Methodology.md')
    await settleLayout(page)
    await rename.screenshot({ path: test.info().outputPath('visual-rename-preview.png') })
  })

  test('Knowledge workbench tab evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open knowledge workbench')
    const workbench = page.getByRole('dialog', { name: 'Knowledge workbench', exact: true })
    await expect(workbench).toBeVisible()

    const states = [
      { tab: 'Views', text: 'Modified this week', image: 'visual-knowledge-views.png' },
      { tab: 'Collections', text: 'Research notes', image: 'visual-knowledge-collections.png' },
      { tab: 'Tags', text: '#research', image: 'visual-knowledge-tags.png' },
      { tab: 'Discover', text: 'Open knowledge graph', image: 'visual-knowledge-discover.png' },
    ] as const

    for (const state of states) {
      const tab = workbench.getByRole('tab', { name: state.tab, exact: true })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expect(workbench).toContainText(state.text)
      await settleLayout(page)
      await workbench.screenshot({ path: test.info().outputPath(state.image) })
    }
  })

  test('Gmail manager disconnected-state evidence', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:enable-gmail-plugin', '1')
      window.localStorage.setItem('scriptor:plugins:consent', JSON.stringify({
        schemaVersion: 1,
        savedAt: '2026-09-07T12:00:00.000Z',
        data: {
          'scriptor.gmail-manager': {
            grantedPermissions: ['read', 'write-approved'],
            allowedVaultIds: ['screenshot-vault'],
            networkAccess: 'blocked',
            allowlistedHosts: [],
            reviewedAt: '2026-09-07T12:00:00.000Z',
          },
        },
      }))
    })
    await openVisualWorkspace(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open Gmail Manager')
    const gmail = page.locator('.gmail-manager-panel')
    await expect(gmail).toBeVisible()
    await expect(gmail).toContainText('Gmail is not connected')
    await gmail.screenshot({ path: test.info().outputPath('visual-gmail-disconnected.png') })
  })

  test('top-bar customization and color-palette surfaces evidence', async ({ page }) => {
    await openVisualWorkspace(page)
    await page.getByRole('button', { name: 'Customize top bar actions' }).click()
    const customizer = page.getByRole('dialog', { name: 'Customize top bar actions', exact: true })
    await expect(customizer).toBeVisible()
    await expect.poll(() => customizer.evaluate((element) => {
      const value = getComputedStyle(element).backgroundColor
      const match = value.match(/^rgba?\((?:[^,]+,){3}\s*([\d.]+)\)$/)
      return match ? Number(match[1]) : 1
    })).toBeGreaterThanOrEqual(0.95)
    await customizer.screenshot({ path: test.info().outputPath('visual-topbar-customizer.png') })
    const paletteToggle = customizer.getByRole('checkbox', { name: 'Color palettes' })
    if (!(await paletteToggle.isChecked())) await paletteToggle.check()
    await page.keyboard.press('Escape')
    const paletteButton = page.getByRole('button', { name: 'Color palettes', exact: true })
    await expect(paletteButton).toBeVisible()
    await paletteButton.click()
    const palettes = page.getByRole('dialog', { name: 'Color palettes', exact: true })
    await expect(palettes).toBeVisible()
    await expect(palettes.getByRole('button', { name: 'Create Custom Palette' })).toBeVisible()
    await palettes.screenshot({ path: test.info().outputPath('visual-color-palettes.png') })
  })

})
