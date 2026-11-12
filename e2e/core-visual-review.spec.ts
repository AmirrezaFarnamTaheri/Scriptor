import { expect, test, type Locator, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers'

/**
 * Additional full-product visual evidence for user decisions that ordinary
 * workspace screenshots cannot establish. All content is deterministic E2E
 * fixture data; no native history restore, publishing or plugin installation
 * occurs outside the browser test harness.
 */
async function captureCore(page: Page, filename: string, focus: Locator) {
  await expect(focus).toBeVisible()
  await focus.scrollIntoViewIfNeeded()
  await expect(focus).toBeInViewport({ ratio: 0.95 })
  await settleLayout(page)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: test.info().outputPath(filename),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  })
}

async function openPanel(page: Page, command: string) {
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  // The built-in module registry finishes hydrating after the basic vault
  // workspace appears. Avoid asserting permission states while still loading.
  if (command === 'Open built-in modules') {
    await expect(page.locator('.job-progress')).toHaveClass(/is-done/, { timeout: 45_000 })
  }
  await openCommandPalette(page)
  await runCommand(page, command)
}

test('Vault search zero matches stays an actual empty result with one clear action', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  const sidebar = page.locator('.vault-panel')
  const query = sidebar.getByRole('searchbox', { name: 'Search notes' })
  await query.fill('scriptor_nonexistent_note_query_8d68e493')
  const empty = sidebar.locator('.vault-search-feedback .search-hint')
  await expect(empty).toContainText('No matching notes')
  await expect(sidebar.getByRole('button', { name: 'Clear search' })).toBeEnabled()
  await captureCore(page, 'visual-core-vault-search-zero-matches.png', empty)
  await sidebar.getByRole('button', { name: 'Clear search' }).click()
  await expect(query).toHaveValue('')
  await expect(sidebar.locator('.vault-search-feedback')).toHaveCount(0)
})

test('Knowledge Graph captures keyboard focus and no-match search without losing controls', async ({ page }) => {
  await openPanel(page, 'Open graph')
  const dialog = page.getByRole('dialog', { name: 'Knowledge graph' })
  await expect(dialog).toBeVisible({ timeout: 15_000 })
  const graph = dialog.locator('svg[role="application"], canvas[role="img"], .graph-canvas').first()
  await expect(graph).toBeVisible()
  await graph.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.locator('[aria-live="polite"]')).toContainText('Field Notes, 2 connections')
  await expect(dialog.locator('.graph-node-focus-ring')).toHaveCount(1)
  await captureCore(page, 'visual-core-graph-keyboard-focused-node.png', graph)
  const search = dialog.getByRole('searchbox', { name: 'Find a note' })
  await search.fill('a-note-that-cannot-exist-8f2')
  const empty = dialog.locator('.graph-note-search-results').getByRole('status')
  await expect(empty).toContainText('No matching notes')
  await expect(dialog.getByRole('button', { name: 'Close graph' })).toBeVisible()
  await captureCore(page, 'visual-core-graph-search-no-matches.png', empty)
})

test('Database Studio mobile table can be navigated before a stale cell edit is rejected', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.addInitScript(() => sessionStorage.setItem('e2e:research', '1'))
  await openPanel(page, 'Database studio')
  const panel = page.getByRole('region', { name: 'Database Studio', exact: true })
  await panel.getByRole('button', { name: 'Load notes', exact: true }).click()
  const table = panel.getByRole('region', { name: 'Database table, scroll horizontally for more columns', exact: true })
  await expect(table).toHaveAttribute('tabindex', '0')
  await expect(table).toHaveCSS('overflow-x', 'auto')
  await captureCore(page, 'visual-core-database-mobile-table-375.png', table)

  await panel.getByRole('button', { name: 'Edit Score in Research Plan.md', exact: true }).click()
  await panel.getByLabel('Score', { exact: true }).fill('24')
  await page.evaluate(() => sessionStorage.setItem('e2e:external-row-edit', 'Research Plan.md'))
  await panel.getByRole('button', { name: 'Save', exact: true }).click()
  const alert = panel.getByRole('alert').filter({ hasText: 'Cell was not saved' })
  await expect(alert).toContainText(/changed|Stale/)
  await captureCore(page, 'visual-core-database-stale-edit-blocked-375.png', alert)
  const writes = await page.evaluate(() =>
    (JSON.parse(sessionStorage.getItem('e2e:research-calls') ?? '[]') as Array<{ cmd: string }>)
      .filter(record => record.cmd === 'vault_frontmatter_set'))
  expect(writes).toHaveLength(0)
})

test('Corrupt saved Database Studio view is visibly blocked without overwriting its source', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:corrupt-db-preset', '1')
  })
  await openPanel(page, 'Database studio')
  const panel = page.getByRole('region', { name: 'Database Studio', exact: true })
  const warning = panel.getByRole('alert')
  await expect(warning).toContainText('Saving is blocked')
  await expect(panel.getByRole('button', { name: 'Save view', exact: true })).toBeDisabled()
  await captureCore(page, 'visual-core-database-corrupt-saved-view.png', warning)
})

test('Lost native note-history restore reply is a visible one-attempt recovery hold', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('e2e:history-restore-lost-reply', '1'))
  await openPanel(page, 'Note history timeline')
  const history = page.getByRole('dialog', { name: 'Note history' })
  const restore = history.getByRole('button', { name: 'Restore revision' })
  await expect(restore).toBeEnabled()
  await restore.click()
  const confirmation = history.getByRole('group', { name: 'Confirm revision restore' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Restore revision' }).click()
  const warning = history.getByRole('alert').filter({
    hasText: 'The previous native history restore result is unconfirmed',
  })
  await expect(warning).toContainText('Reopen this vault')
  await expect(restore).toBeDisabled()
  await captureCore(page, 'visual-core-history-restore-outcome-unconfirmed.png', warning)
  await expect.poll(() => page.evaluate(() => window.__scriptorE2eHistoryRestoreAttempts ?? 0)).toBe(1)
})

test('Publishing exclusion is explained before review and confirmed after explicit opt-out', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:publishing-audit', '1')
  })
  await openPanel(page, 'Publishing studio')
  const studio = page.getByRole('region', { name: 'Publishing studio', exact: true })
  await studio.getByLabel('Local site folder', { exact: true }).fill('C:/reviewed-site')
  await studio.getByRole('button', { name: 'Review publication plan', exact: true }).click()
  const note = studio.locator('tbody tr').filter({ hasText: 'Research Plan.md' })
  await expect(note).toContainText('Excluded by the current plan')
  const optOut = note.getByRole('button', { name: 'Opt out Research Plan.md', exact: true })
  await expect(optOut).toBeEnabled()
  await captureCore(page, 'visual-core-publishing-excluded-plan-row.png', note)
  await optOut.click()
  const status = studio.getByRole('status').filter({
    hasText: 'Note excluded from the next publication plan',
  })
  await expect(status).toBeVisible()
  await captureCore(page, 'visual-core-publishing-exclusion-confirmed.png', status)
  const writes = await page.evaluate(() =>
    (JSON.parse(sessionStorage.getItem('e2e:research-calls') ?? '[]') as Array<{
      cmd: string
      payload: Record<string, unknown>
    }>).filter(record => record.cmd === 'vault_frontmatter_set'))
  expect(writes).toHaveLength(1)
  expect(writes[0]?.payload.field).toBe('publish')
  expect(writes[0]?.payload.value).toBe('false')
})

test('Plugin workspace cannot open without reviewed permissions', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('scriptor:plugins:consent', JSON.stringify({
    schemaVersion: 1, savedAt: '2026-11-13T00:00:00Z', data: {},
  })))
  await openPanel(page, 'Open built-in modules')
  const manager = page.getByRole('dialog', { name: 'Built-in modules', exact: true })
  await manager.getByRole('searchbox').fill('Runtime workspace overview')
  const launch = manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true })
  await expect(launch).toBeDisabled()
  const permission = manager.getByText('Review this plugin’s permissions in the marketplace first.', { exact: true })
  await expect(permission).toBeVisible()
  await captureCore(page, 'visual-core-plugin-unreviewed-permissions.png', permission)
})

test('Plugin safe mode explains blocked launch in narrow dark RTL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => sessionStorage.setItem('scriptor.plugins.safeMode', 'true'))
  await launchApp(page, { theme: 'dark' })
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await page.locator('html').evaluate(element => { element.dir = 'rtl' })
  await openCommandPalette(page)
  await runCommand(page, 'Open built-in modules')
  const manager = page.getByRole('dialog', { name: 'Built-in modules', exact: true })
  await manager.getByRole('searchbox').fill('Runtime workspace overview')
  const disabled = manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true })
  await expect(disabled).toBeDisabled()
  const explanation = manager.getByText('Plugin workspaces are unavailable in safe mode.', { exact: true })
  await expect(explanation).toBeVisible()
  await captureCore(page, 'visual-core-plugin-safe-mode-dark-rtl-390.png', explanation)
})

test('Diagram Studio shows a rendered graph and an actionable invalid-source view', async ({ page }) => {
  // Preserve the restrictive WASM worker policy tested by the functional suite.
  await page.route(/graphviz\.worker.*\.js$/, async route => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'",
      },
    })
  })
  await openPanel(page, 'Diagram studio')
  const studio = page.getByRole('region', { name: 'Diagram studio', exact: true })
  await studio.getByLabel('Language', { exact: true }).selectOption('dot')
  const source = studio.getByLabel('Diagram source', { exact: true })
  await source.fill('digraph { Evidence -> Draft -> Review }')
  const render = studio.getByRole('button', { name: 'Render diagram', exact: true })
  await render.click()
  const image = studio.getByRole('img', { name: 'Graphviz diagram', exact: true })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((element: HTMLImageElement) =>
    element.complete && element.naturalWidth > 0)).toBe(true)
  await captureCore(page, 'visual-core-diagram-rendered-graphviz.png', image)

  await source.fill('digraph { broken -> }')
  await render.click()
  const error = studio.getByText(/Graphviz:.*syntax error/)
  await expect(error).toBeVisible()
  await expect(studio.getByRole('region', { name: 'Diagram viewport' }))
    .toContainText('digraph { broken -> }')
  await captureCore(page, 'visual-core-diagram-invalid-source-fallback.png', error)
})


test('Export format preflight names alternative renderer requirements before export', async ({ page }) => {
  await openPanel(page, 'Open publish center')
  const publish = page.getByRole('dialog', { name: 'Export & publish' })
  const format = publish.getByRole('combobox', { name: 'Export format' })
  await format.selectOption('pdf-typst')
  await expect(publish.getByText('PDF via the Typst engine; requires Typst to be installed.')).toBeVisible()
  await expect(publish.locator('.publish-format-destination code')).toContainText('exports/typst')
  await captureCore(page, 'visual-core-pdf-typst-installation-requirements.png', format)
  await format.selectOption('html-standalone')
  const preview = publish.getByRole('button', { name: 'Preview export', exact: true })
  await expect(preview).toBeVisible()
  await expect(publish.locator('.publish-format-destination code')).toContainText('exports/html')
  await captureCore(page, 'visual-core-html-export-destination.png', preview)
})

test('Degraded Markdown inspector keeps the core preview and an explanatory status', async ({ page }) => {
  await page.addInitScript((prefs) => {
    localStorage.setItem('scriptor:app-theme', 'light')
    localStorage.setItem('scriptor:onboarding-complete', 'true')
    localStorage.setItem('scriptor:editor-mode', 'monaco')
    localStorage.setItem('scriptor:workspace-mode', 'writing')
    localStorage.setItem('scriptor:inspector-preset', 'balanced')
    localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(prefs))
    sessionStorage.setItem('e2e:preview-postprocess-failure', '1')
  }, WORKSPACE_CHROME_PREFS)
  await launchApp(page)
  await waitForWorkspace(page)
  await expect(page.locator('.inspector-panel')).toBeVisible()
  await page.getByRole('tab', { name: 'Rendered output', exact: true }).click()
  const inspector = page.locator('.inspector-panel').getByRole('article', {
    name: 'Markdown preview',
  })
  await expect(inspector).toHaveAttribute('data-preview-degraded', 'true')
  await expect(inspector.getByRole('heading', { name: 'Research Plan' })).toBeVisible()
  const status = inspector.getByRole('status')
  await expect(status).toContainText('Showing the core Markdown render')
  await expect(inspector.getByRole('alert')).toHaveCount(0)
  await captureCore(page, 'visual-core-inspector-markdown-degraded-fallback.png', status)
})

test('Search results emphasize literal match without interpreting neighboring HTML', async ({ page }) => {
  await launchApp(page)
  await page.evaluate(() => {
    const internals = (window as Window & {
      __TAURI_INTERNALS__: {
        invoke(command: string, args?: Record<string, unknown>, options?: unknown): Promise<unknown>
      }
    }).__TAURI_INTERNALS__
    const original = internals.invoke.bind(internals)
    internals.invoke = async (command, args = {}, options) => {
      if (command === 'indexer_search') return [{
        path: 'Methodology.md',
        title: 'Methodology',
        snippet: 'Surrounding context [Methodology] <script>literal()</script> after.',
        score: 1,
      }]
      return original(command, args, options)
    }
  })
  const input = page.getByRole('searchbox', { name: 'Search notes', exact: true })
  await input.fill('Methodology')
  const dock = page.locator('#dock-panel-search')
  await expect(dock.locator('small mark')).toHaveText('Methodology')
  await expect(dock.locator('small')).toContainText('<script>literal()</script>')
  await expect(dock.locator('small script')).toHaveCount(0)
  await captureCore(page, 'visual-core-search-literal-markup-highlighted.png',
    dock.locator('.dock-list > li').first())
})
