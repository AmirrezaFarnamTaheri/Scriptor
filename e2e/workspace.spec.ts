import { expect, test } from '@playwright/test'

import {
  appendEditorLine,
  E2E_SEARCH_MARKER,
  launchApp,
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
    await expect(page.locator('.vault-skeleton-row').first()).toBeVisible({ timeout: 2_000 })
    await waitForWorkspace(page)
  })

  test('first-run onboarding can be skipped', async ({ page }) => {
    await page.addInitScript(() => {
      if (window.sessionStorage.getItem('e2e:onboarding-cleared') !== '1') {
        window.localStorage.removeItem('scriptor:onboarding-complete')
        window.sessionStorage.setItem('e2e:onboarding-cleared', '1')
      }
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    const tour = page.getByRole('dialog', { name: 'Product tour' })
    await expect(tour).toBeVisible()
    await tour.getByRole('button', { name: 'Skip tour' }).click()
    await expect(tour).toBeHidden()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('dialog', { name: 'Product tour' })).toBeHidden()
  })

  test('workspace session persists open tabs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
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

    await page.reload({ waitUntil: 'networkidle' })
    await waitForWorkspace(page)
    await expect(page.locator('.tabs-row .tab')).toHaveCount(2, { timeout: 10_000 })
  })

  test('high-contrast theme sets data-theme attribute', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'high-contrast')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast')
  })

  test('note history panel lists revisions and restores', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    await page.keyboard.press('Control+KeyK')
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await palette.getByRole('searchbox').fill('Note history')
    await palette.getByRole('option', { name: 'Note history timeline' }).click()

    const historyPanel = page.getByRole('dialog', { name: 'Note history' })
    await expect(historyPanel).toBeVisible()
    await expect(historyPanel.getByText(/words/)).toBeVisible()
    await expect(historyPanel.locator('.note-history-markdown')).toContainText('Previous revision')

    await historyPanel.getByRole('button', { name: 'Restore revision' }).click()
    await expect(historyPanel).toBeHidden({ timeout: 10_000 })
  })

  test('save note, search hit, and export HTML dry-run', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)

    await appendEditorLine(page, E2E_SEARCH_MARKER)
    await waitForSavedMarker(page, E2E_SEARCH_MARKER)

    const searchInput = page.getByRole('searchbox', { name: 'Search notes' })
    await searchInput.fill(E2E_SEARCH_MARKER)
    await expect(page.getByText('1 result', { exact: false })).toBeVisible({ timeout: 10_000 })

    const searchPanel = page.getByRole('region', { name: 'Search results' })
    await expect(searchPanel.getByRole('button', { name: /Research Plan/ })).toBeVisible()
    await expect(searchPanel).toContainText(E2E_SEARCH_MARKER)

    await page.locator('.top-actions').getByRole('button', { name: 'Publish', exact: true }).click()
    const publishDialog = page.getByRole('dialog', { name: 'Publish center' })
    await expect(publishDialog).toBeVisible()

    await publishDialog
      .locator('.publish-profile-list > li')
      .first()
      .getByRole('button', { name: 'Dry run' })
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

  test('performance HUD toggle shows metrics overlay', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
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
    await page.goto('/', { waitUntil: 'networkidle' })
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
    // The `e2e:hash-mismatch` flag this test sets is not honoured anywhere in
    // src/ — no fixture ever produces a content-hash mismatch, so the warning
    // locator could never match. The old body called isVisible() and threw the
    // result away, leaving a test that asserted nothing about integrity.
    test.skip(
      true,
      'No E2E fixture produces a content-hash mismatch; src/e2e/bootstrap.ts does not implement the e2e:hash-mismatch flag.',
    )
    void page
  })

  test('corrupted session data falls back to defaults', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:workspace-chrome', 'INVALID_JSON{{{')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
    const root = page.locator('#root')
    await expect(root).toBeVisible()
  })

  test('missing workspace chrome prefs use defaults', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('scriptor:workspace-chrome')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
    await expect(page.locator('#root')).toBeVisible()
  })
})
