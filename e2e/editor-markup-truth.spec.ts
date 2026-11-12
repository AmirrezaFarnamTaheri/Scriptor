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

  test('mixed wikilinks and embeds retain both decorations in document order', async ({ page }) => {
    const preview = await openSplitPreview(page)
    await preview.locator('.cm-content').fill('[[Before]] then ![[Image]] and [[After]]')
    await expect(preview.locator('.cm-wikilink')).toHaveCount(2)
    await expect(preview.locator('.cm-wikilink-embed')).toHaveCount(1)
    await expect(preview.locator('.cm-content')).toContainText('[[Before]] then ![[Image]] and [[After]]')
  })

  test('split preview shows an in-progress task status without changing its Markdown bytes', async ({ page }) => {
    const preview = await openSplitPreview(page)
    const taskLine = preview.locator('.cm-line', { hasText: 'Draft methodology' })
    await expect(taskLine).toHaveCount(1)

    // The active authoring line deliberately reveals the original Markdown.
    // Move the caret to another line before asserting the inactive-line widget;
    // the editor's initial selection varies between browser environments.
    const otherLine = preview.locator('.cm-line', { hasText: 'Outline' })
    await expect(otherLine).toBeVisible()
    await otherLine.click()

    // Inactive task lines present the same semantic state as rendered output.
    const indicator = taskLine.locator('.cm-wysiwyg-task-status')
    await expect(indicator).toHaveAttribute('data-task-state', 'in-progress')
    await expect(indicator).toHaveAttribute('aria-label', 'In Progress task')
    await expect(taskLine).not.toContainText('[/]')

    // Selecting the line reveals the exact authored syntax for lossless editing.
    await taskLine.click()
    await expect(taskLine).toContainText('- [/] Draft methodology')
  })

  test('cancelled and forwarded statuses are distinguishable in editable preview', async ({ page }) => {
    const preview = await openSplitPreview(page)
    await preview.locator('.cm-content').fill(['# Task states', '- [-] Cancelled step', '- [>] Forwarded step', '', 'Footer'].join('\n'))
    await expect(preview.locator('[data-task-state="cancelled"]')).toHaveAttribute('aria-label', 'Cancelled task')
    await expect(preview.locator('[data-task-state="forwarded"]')).toHaveAttribute('aria-label', 'Forwarded task')
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
