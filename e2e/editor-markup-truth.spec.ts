import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { launchApp, waitForWorkspace } from './helpers'

/**
 * Both editor surfaces are live views of the author's Markdown, so neither may
 * invent syntax the author did not write. These cover the two ways they used
 * to: the source surface painted a wikilink's closing bracket red, and the
 * WYSIWYG surface ate the brackets of Scriptor's own `[/]` task marker.
 */
async function openSplitPreview(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()
  const preview = page.locator('.editable-preview-editor')
  await expect(preview).toBeVisible({ timeout: 30_000 })
  return preview
}

test.describe('Editor markup fidelity', () => {
  test('source editor does not flag wikilink brackets as unmatched', async ({ page }) => {
    await launchApp(page)
    await waitForWorkspace(page)
    await page.waitForSelector('.view-line', { timeout: 20_000 })

    const line = page.locator('.view-line', { hasText: 'Field Notes' }).first()
    await expect(line).toBeVisible({ timeout: 20_000 })
    // Monaco's bracket-pair colorizer marked the closing `]` of `[[Field Notes]]`
    // as an "unexpected closing bracket" and painted it red, because Markdown
    // has no bracket syntax for it to match.
    await expect(line.locator('.unexpected-closing-bracket')).toHaveCount(0)
    await expect(line).toContainText('[[Field Notes]]')
  })

  test('split preview keeps Scriptor task markers intact', async ({ page }) => {
    const preview = await openSplitPreview(page)
    const taskLine = preview.locator('.cm-line', { hasText: 'Draft methodology' })
    await expect(taskLine).toHaveCount(1)
    // `[/]` is Scriptor's in-progress marker. The Markdown parser used to read
    // it as a shortcut link reference, and the WYSIWYG decorations then hid the
    // brackets as link syntax — showing `- / Draft methodology`.
    await expect(taskLine).toContainText('- [/] Draft methodology')
  })

  test('the workspace reports no problems for a note that only uses task markers', async ({ page }) => {
    await launchApp(page)
    await waitForWorkspace(page)
    // The footer summary renames itself to "Problems N" as soon as the count is
    // non-zero, so its absence of that name is the honest end-to-end assertion:
    // the `[/]` marker used to be reported as a missing link reference, which
    // made every note that used it advertise a problem with nothing wrong
    // behind it. Assert the negative so a regression names itself.
    await expect(page.getByRole('button', { name: /Problems/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Background jobs/ })).toBeVisible()
  })
})
