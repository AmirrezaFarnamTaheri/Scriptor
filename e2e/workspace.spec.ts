import { expect, test } from '@playwright/test'

import {
  appendEditorLine,
  E2E_SEARCH_MARKER,
  launchApp,
  openCommandPalette,
  settleLayout,
  waitForSavedMarker,
  waitForWorkspace,
  WORKSPACE_CHROME_PREFS,
} from './helpers.ts'

test.describe('workspace flows', () => {
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

  test('vault open shows skeleton rows while indexing', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:slow-vault', '1')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vault-skeleton-row').first()).toBeVisible({ timeout: 5_000 })
    await waitForWorkspace(page)
  })

  test('first-run onboarding can be skipped', async ({ page }) => {
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('e2e:onboarding-cleared') !== '1') {
        window.localStorage.removeItem('scriptor:onboarding-complete')
        window.sessionStorage.setItem('e2e:onboarding-cleared', '1')
      }
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const tour = page.getByRole('dialog', { name: 'Product tour' })
    await expect(tour).toBeVisible()
    await expect(tour.getByRole('button', { name: 'Next' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(tour).toBeVisible()
    await tour.getByRole('button', { name: 'Skip tour' }).click()
    await expect(tour).toBeHidden()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('dialog', { name: 'Product tour' })).toBeHidden()
  })

  test('workspace session persists open tabs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    await page.evaluate(() => {
      window.localStorage.setItem(
        'e2e:open-tabs',
        JSON.stringify([
          { path: 'Research Plan.md', pinned: false },
          { path: 'Field Notes.md', pinned: false },
        ]),
      )
      window.localStorage.setItem('e2e:active-path', 'Research Plan.md')
    })
    await page.waitForFunction(() => {
      const tabs = window.localStorage.getItem('e2e:open-tabs')
      return tabs !== null
    }, { timeout: 5000 })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    await expect(page.locator('.tabs-row .tab')).toHaveCount(2, { timeout: 10_000 })
  })

  test('high-contrast theme sets data-theme attribute', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'high-contrast')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast')
  })

  test('note history panel lists revisions and restores', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('searchbox').fill('Note history')
    await palette.getByRole('option', { name: 'Note history timeline' }).click()

    const historyPanel = page.getByRole('dialog', { name: 'Note history' })
    await expect(historyPanel).toBeVisible()
    await expect(historyPanel.getByText(/words/)).toBeVisible()
    await expect(historyPanel.locator('.note-history-revision-markdown')).toContainText('Previous revision')

    const readEditorContent = () =>
      page.evaluate(() => {
        const editor = (window as Window & {
          __scriptorE2eEditor?: { getModel?: () => { getValue?: () => string } | null }
        }).__scriptorE2eEditor
        return editor?.getModel?.()?.getValue?.() ?? ''
      })
    const editorContentBeforeRestore = await readEditorContent()
    await historyPanel.getByRole('button', { name: 'Restore revision' }).click()
    const confirmation = historyPanel.getByRole('group', { name: 'Confirm revision restore' })
    await expect(confirmation).toBeVisible()
    await expect(historyPanel).toBeVisible()
    await expect.poll(readEditorContent).toBe(editorContentBeforeRestore)
    await confirmation.getByRole('button', { name: 'Restore revision' }).click()
    await expect(historyPanel).toBeHidden({ timeout: 10_000 })
    await expect.poll(readEditorContent, { timeout: 10_000 }).toBe('# Restored\n')
  })

  test('save note, search hit, and export HTML dry-run', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    await appendEditorLine(page, E2E_SEARCH_MARKER)
    await waitForSavedMarker(page, E2E_SEARCH_MARKER)

    const searchInput = page.getByRole('searchbox', { name: 'Search notes' })
    await searchInput.fill(E2E_SEARCH_MARKER)

    const searchPanel = page.locator('#dock-panel-search')
    await expect(searchPanel).toBeVisible({ timeout: 10_000 })
    await expect(searchPanel.getByRole('button', { name: /Research Plan/ })).toBeVisible({ timeout: 10_000 })
    await expect(searchPanel).toContainText(E2E_SEARCH_MARKER)
    await expect(page.getByRole('tab', { name: /Search results\s+1/i })).toBeVisible()

    await page.locator('.workspace-mode-strip').getByRole('button', { name: 'Publish', exact: true }).click()
    const publishDialog = page.getByRole('dialog', { name: 'Export & publish' })
    await expect(publishDialog).toBeVisible()

    await publishDialog
      .locator('.publish-profile-list > li')
      .first()
      .getByRole('button', { name: 'Preview export' })
      .click()

    await expect(publishDialog.getByRole('heading', { name: 'Preflight preview' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(publishDialog.locator('.publish-command-preview')).toContainText('pandoc', {
      ignoreCase: true,
    })
    await expect(publishDialog.locator('.publish-command-preview')).toContainText('Research Plan.md')
    await expect(publishDialog.getByText('Dry run complete')).toBeVisible()
  })

  test('command palette search remains geometrically stable while note search resolves', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:search-delay', '1')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    await openCommandPalette(page)

    const palette = page.getByRole('dialog', { name: 'Command palette' })
    const search = palette.getByRole('searchbox')
    const list = palette.locator('#command-palette-list')
    await search.fill('Research')

    const first = await list.boundingBox()
    expect(first).not.toBeNull()
    await page.waitForTimeout(320)
    const during = await list.boundingBox()
    expect(during).not.toBeNull()
    expect(Math.abs((during?.y ?? 0) - (first?.y ?? 0))).toBeLessThanOrEqual(1)

    await page.waitForTimeout(850)
    const settled = await list.boundingBox()
    expect(settled).not.toBeNull()
    expect(Math.abs((settled?.y ?? 0) - (first?.y ?? 0))).toBeLessThanOrEqual(1)
  })

  test('top-bar command entry stays stable while the editor draft changes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    const commandEntry = page.locator('.command-search')
    const baseline = await commandEntry.boundingBox()
    expect(baseline).not.toBeNull()
    const background = await commandEntry.evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(background).not.toBe('rgba(0, 0, 0, 0)')

    await appendEditorLine(page, 'command-search-flicker-regression')
    await page.waitForTimeout(900)

    const next = await commandEntry.boundingBox()
    expect(next).not.toBeNull()
    expect(Math.abs((next?.x ?? 0) - (baseline?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((next?.y ?? 0) - (baseline?.y ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((next?.width ?? 0) - (baseline?.width ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((next?.height ?? 0) - (baseline?.height ?? 0))).toBeLessThanOrEqual(1)
  })

  test('performance HUD toggle shows metrics overlay', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('searchbox').fill('performance HUD')
    await palette.getByRole('option', { name: 'Show performance HUD' }).click()

    const hud = page.locator('.perf-hud-overlay')
    await expect(hud).toBeVisible()
    await expect(hud).toContainText('Vault open')
    await expect(hud).toContainText('Tabs')
  })

  test('insert footnote command adds reference marker', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('searchbox').fill('Insert footnote')
    await palette.getByRole('option', { name: 'Insert footnote reference' }).click()

    await expect(page.locator('.monaco-editor .view-lines')).toContainText('[^', { timeout: 10_000 })
  })

  test('handles invalid vault path gracefully', async ({ page }) => {
    const p = await launchApp(page)
    await settleLayout(p)
    const root = p.locator('#root')
    await expect(root).toBeVisible()
  })

  test('hash mismatch shows integrity warning', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:hash-mismatch', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await appendEditorLine(page, 'Local edit that races an external disk change.')

    const banner = page.getByRole('alert').filter({ hasText: 'This note changed on disk' })
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await expect(banner.getByRole('button', { name: 'Reload from disk' })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Keep editing' })).toBeVisible()
  })

  test('reload from disk discards local edits after a hash mismatch', async ({ page }) => {
    const localMarker = 'Local edit to discard after external change.'
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:hash-mismatch', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await appendEditorLine(page, localMarker)

    const banner = page.getByRole('alert').filter({ hasText: 'This note changed on disk' })
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: 'Reload from disk' }).click()

    await expect(banner).toBeHidden()
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('External disk edit.')
    await expect(page.locator('.monaco-editor .view-lines')).not.toContainText(localMarker)
    await expect(page.getByLabel('Unsaved changes')).toHaveCount(0)
  })

  test('keep editing preserves local edits and allows the next save', async ({ page }) => {
    const localMarker = 'Local edit to preserve after external change.'
    await page.addInitScript(() => {
      window.sessionStorage.setItem('e2e:hash-mismatch', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await appendEditorLine(page, localMarker)

    const banner = page.getByRole('alert').filter({ hasText: 'This note changed on disk' })
    await expect(banner).toBeVisible({ timeout: 15_000 })
    await banner.getByRole('button', { name: 'Keep editing' }).click()

    await expect(banner).toBeHidden()
    await expect(page.locator('.monaco-editor .view-lines')).toContainText(localMarker)
    await appendEditorLine(page, 'Follow-up edit triggers the overwrite save.')
    await waitForSavedMarker(page, localMarker)
    await expect(page.getByLabel('Unsaved changes')).toHaveCount(0)
  })

  test('corrupted session data falls back to defaults', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:workspace-chrome', 'INVALID_JSON{{{')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    const root = page.locator('#root')
    await expect(root).toBeVisible()
  })

  test('missing workspace chrome prefs use defaults', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('scriptor:workspace-chrome')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)
    await expect(page.locator('#root')).toBeVisible()
  })

  test('workspace chrome sanitizes valid-envelope corruption and stale panel widths', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:vault-width', '-500')
      window.localStorage.setItem('scriptor:inspector-width', '9999')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify({
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        data: {
          editorFontSize: -50,
          editorFontFamily: 'comic-sans',
          editorLineHeight: 99,
          editorPaddingPx: 0,
          previewMaxWidthCh: 999,
          editorSurfaceMode: 'triple',
          vaultWidth: -500,
          inspectorWidth: 9999,
          uiFontFamily: 'papyrus',
          uiDensity: 'microscopic',
          uiBorderRadius: 'chaos',
          glassBlur: 'infinite',
          topBarHiddenActions: ['graph', 'graph', '', 42, 'canvas'],
          topBarGroupOrder: ['actions', 'actions', 'unknown'],
          topBarHiddenGroups: ['history', 'history', 'unknown'],
          topBarGroupWidths: { history: 'wide', modes: 'giant', bogus: 'auto' },
          topBarActionRows: 7,
        },
      }))
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForWorkspace(page)

    const grid = page.locator('.workspace-grid')
    await expect.poll(() => grid.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--vault-width').trim(),
    )).toBe('200px')
    await expect.poll(() => grid.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--inspector-width').trim(),
    )).toBe('800px')

    const stored = await expect.poll(() => page.evaluate(() => {
      const raw = window.localStorage.getItem('scriptor:workspace-chrome')
      return raw ? JSON.parse(raw).data : null
    })).not.toBeNull()

    const normalized = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('scriptor:workspace-chrome') ?? '{}').data,
    )
    expect(normalized.editorFontSize).toBe(11)
    expect(normalized.editorLineHeight).toBe(2.4)
    expect(normalized.editorPaddingPx).toBe(4)
    expect(normalized.previewMaxWidthCh).toBe(120)
    expect(normalized.vaultWidth).toBe(200)
    expect(normalized.inspectorWidth).toBe(800)
    expect(normalized.editorSurfaceMode).toBe('source')
    expect(normalized.editorFontFamily).toBe('jetbrains-mono')
    expect(normalized.uiFontFamily).toBe('system')
    expect(normalized.uiDensity).toBe('comfortable')
    expect(normalized.uiBorderRadius).toBe('rounded')
    expect(normalized.glassBlur).toBe('glass')
    expect(normalized.topBarHiddenActions).toEqual(['graph', 'canvas'])
    expect(normalized.topBarGroupOrder).toEqual(['actions', 'history', 'modes', 'command'])
    expect(normalized.topBarHiddenGroups).toEqual(['history'])
    expect(normalized.topBarGroupWidths).toEqual({ history: 'wide' })
    expect(normalized.topBarActionRows).toBe(1)
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('scriptor:vault-width'))).toBeNull()
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('scriptor:inspector-width'))).toBeNull()
    void stored
  })
})