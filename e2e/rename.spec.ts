import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { launchApp, settleLayout, waitForWorkspace } from './helpers'

/**
 * There is no `rename-note` command in the palette (see
 * src/lib/buildPaletteCommands.ts) — the rename dialog is opened by
 * right-clicking a note row in the vault sidebar (VirtualNoteList onContextMenu).
 * The previous version of this spec drove a palette command that does not
 * exist, so every rename test here was dead.
 */
async function openRenameDialog(page: Page, noteFile: string): Promise<Locator> {
  await launchApp(page)
  await waitForWorkspace(page)
  await settleLayout(page)
  await page
    .locator('.virtual-note-list')
    .getByRole('button', { name: noteFile, exact: true })
    .click({ button: 'right' })
  const dialog = page.getByRole('dialog', { name: 'Rename note' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

function editorText(page: Page): Locator {
  return page.locator('.monaco-editor .view-lines').or(page.locator('.cm-content'))
}

test.describe('Note rename', () => {
  test('rename dialog structure is accessible', async ({ page }) => {
    const dialog = await openRenameDialog(page, 'Research Plan.md')
    await expect(dialog.getByRole('heading', { name: 'Rename note' })).toBeVisible()
    await expect(dialog.locator('.rename-current-path code')).toHaveText('Research Plan.md')
    await expect(dialog.getByRole('textbox', { name: 'New filename' })).toBeVisible()
    await expect(
      dialog.getByRole('checkbox', { name: 'Update wikilinks across the vault' }),
    ).toBeChecked()
    await expect(dialog.getByRole('button', { name: 'Dry run' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Apply rename' })).toBeEnabled()
  })

  test('rename dialog opens with the current filename prefilled', async ({ page }) => {
    const dialog = await openRenameDialog(page, 'Research Plan.md')
    const input = dialog.getByRole('textbox', { name: 'New filename' })
    await expect(input).toHaveValue('Research Plan')
  })

  test('rename preview shows affected links', async ({ page }) => {
    const dialog = await openRenameDialog(page, 'Research Plan.md')
    await dialog.getByRole('textbox', { name: 'New filename' }).fill('Research Plan Renamed')
    await dialog.getByRole('button', { name: 'Dry run' }).click()

    // Both `Field Notes.md` and `Methodology.md` link to [[Research Plan]].
    const preview = dialog.locator('.rename-preview')
    await expect(preview).toBeVisible({ timeout: 10_000 })
    await expect(preview.locator('strong')).toHaveText('2 link edits across 2 files')
    await expect(preview.locator('li')).toHaveText(['Field Notes.md', 'Methodology.md'])
  })

  test('closing the rename dialog applies no changes', async ({ page }) => {
    const dialog = await openRenameDialog(page, 'Research Plan.md')
    await dialog.getByRole('textbox', { name: 'New filename' }).fill('Should Not Apply')
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden({ timeout: 5000 })

    expect(await page.evaluate(() => window.__scriptorE2eRenameApply)).toBeUndefined()
    await expect(
      page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md', exact: true }),
    ).toBeVisible()
  })

  test('rename rewrites the wikilink in a second note', async ({ page }) => {
    const dialog = await openRenameDialog(page, 'Research Plan.md')
    await dialog.getByRole('textbox', { name: 'New filename' }).fill('Research Plan Renamed')
    await expect(
      dialog.getByRole('checkbox', { name: 'Update wikilinks across the vault' }),
    ).toBeChecked()
    await dialog.getByRole('button', { name: 'Apply rename' }).click()
    await expect(dialog).toBeHidden({ timeout: 15_000 })

    // The app asked the vault to rewrite links as part of the rename…
    await expect
      .poll(() => page.evaluate(() => window.__scriptorE2eRenameApply), { timeout: 10_000 })
      .toEqual({
        fromPath: 'Research Plan.md',
        toPath: 'Research Plan Renamed.md',
        updateLinks: true,
      })

    // …and a *different* note now points at the new name.
    await page
      .locator('.virtual-note-list')
      .getByRole('button', { name: 'Methodology.md', exact: true })
      .click()
    await expect(editorText(page)).toContainText('[[Research Plan Renamed]]', { timeout: 20_000 })
    await expect(editorText(page)).not.toContainText('[[Research Plan]]')
  })

  test('rename input rejects an empty name', async ({ page }) => {
    const dialog = await openRenameDialog(page, 'Research Plan.md')
    const input = dialog.getByRole('textbox', { name: 'New filename' })
    await input.fill('')
    await dialog.getByRole('button', { name: 'Apply rename' }).click()

    // The input is `required`, so the form never submits and the dialog stays up.
    await expect(dialog).toBeVisible()
    expect(await page.evaluate(() => window.__scriptorE2eRenameApply)).toBeUndefined()
    expect(await input.evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(
      true,
    )
  })
})
