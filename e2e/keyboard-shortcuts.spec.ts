import { expect, test } from '@playwright/test'

import { settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

test('settings exposes and persists keyboard shortcut editing', async ({ page }) => {
  await page.addInitScript((chromePrefs) => {
    window.localStorage.setItem('scriptor:app-theme', 'light')
    window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    window.localStorage.setItem('scriptor:editor-mode', 'monaco')
    window.localStorage.setItem('scriptor:workspace-mode', 'writing')
    window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
  }, WORKSPACE_CHROME_PREFS)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)
  await settleLayout(page)

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await expect(settings).toBeVisible()

  const shortcutsTab = settings.getByRole('tab', { name: 'Shortcuts', exact: true })
  await expect(shortcutsTab).toBeVisible()
  await shortcutsTab.click()

  const table = settings.getByRole('table', { name: 'Keyboard shortcuts' })
  await expect(table).toBeVisible()
  // Keep developer-only command IDs and repetitive Default badges off the
  // everyday settings table while preserving IDs in accessible tooltips.
  await expect(table.locator('.shortcut-command-copy small')).toHaveCount(0)
  await expect(table.locator('.shortcut-default-badge')).toHaveCount(0)
  await expect(table.locator('.shortcut-command-copy').first().locator('strong')).toHaveAttribute('title', /^Command ID:/)
  // An unmodified keymap should not show a pointless global reset button.
  await expect(settings.getByRole('button', { name: 'Reset all' })).toHaveCount(0)
  const shortcutSearch = settings.getByRole('searchbox', { name: 'Search commands' })
  await shortcutSearch.fill('no-matching-commands-zzq')
  await expect(settings.getByText('No commands match this search.')).toBeVisible()
  await settings.getByRole('button', { name: 'Clear search' }).click()
  await expect(shortcutSearch).toHaveValue('')
  const graphInput = settings.getByLabel('Shortcut for Open graph')
  await expect(graphInput).toHaveValue('Alt+G')
  await graphInput.fill('Alt+H')
  await graphInput.press('Enter')
  await expect(graphInput).toHaveValue('Alt+H')

  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('scriptor:keyboard-shortcuts') ?? ''),
    )
    .toContain('Alt+H')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)
  await settleLayout(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  await expect(settings).toBeVisible()
  await settings.getByRole('tab', { name: 'Shortcuts', exact: true }).click()
  await expect(graphInput).toHaveValue('Alt+H')

  await settings.getByRole('button', { name: 'Reset all' }).click()
  await expect(graphInput).toHaveValue('Alt+G')
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('scriptor:keyboard-shortcuts') ?? ''))
    .not.toContain('Alt+H')
})