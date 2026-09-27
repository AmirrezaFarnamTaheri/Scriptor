import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { appendEditorLine, launchApp, waitForWorkspace } from './helpers'

/**
 * Mermaid's own `run()` is all-or-nothing: it rejects on the first diagram that
 * fails to parse, so one bad fence used to leave every later diagram on the page
 * unrendered, and the failing one just sat there looking like ordinary body text.
 *
 * These prove the real preview in a real browser: a broken diagram becomes a
 * labelled, accessible block that keeps its source, and a valid diagram after it
 * still renders.
 */

const BROKEN_FENCE = '```mermaid\nthis is not a diagram at all\n```'
const VALID_FENCE = '```mermaid\ngraph TD\n  Alpha-->Beta\n```'

async function openPreviewWithDiagrams(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' }).click()
  await expect(page.locator('.view-line').first()).toBeVisible({ timeout: 20_000 })

  // Broken first, so a batch abort would strand the valid one behind it.
  await appendEditorLine(page, '')
  await appendEditorLine(page, BROKEN_FENCE)
  await appendEditorLine(page, VALID_FENCE)

  await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.locator('.markdown-preview, .preview-surface, .editable-preview-editor').first()
  await expect(preview).toBeVisible({ timeout: 20_000 })
  // Mermaid is loaded lazily; give the enhancement a chance to settle.
  await page.waitForTimeout(4000)
  return preview
}

test('a broken diagram shows an accessible failure block and keeps its source', async ({ page }) => {
  const preview = await openPreviewWithDiagrams(page)

  const failed = preview.locator('.mermaid-render-failure')
  await expect(failed).toHaveCount(1)
  // Announced as a note rather than read out as body prose.
  await expect(failed).toHaveAttribute('role', 'note')
  await expect(failed).toContainText('Diagram could not be rendered')
  // The author's source survives so it can be repaired.
  await expect(failed).toContainText('this is not a diagram at all')
  // Never a broken image glyph or an empty container.
  await expect(failed.locator('img')).toHaveCount(0)
  expect(((await failed.textContent()) ?? '').trim().length).toBeGreaterThan(0)

  // The heading already states that the diagram did not render, so a reason line
  // must either add real detail or be absent — never restate the heading.
  const reasons = failed.locator('.mermaid-failure-reason')
  const reasonCount = await reasons.count()
  if (reasonCount > 0) {
    const reason = (await reasons.first().textContent())?.trim() ?? ''
    expect(reason.toLowerCase()).not.toContain('could not be rendered')
    expect(reason.length).toBeGreaterThan(0)
  }
})

test('a valid diagram after a broken one still renders', async ({ page }) => {
  const preview = await openPreviewWithDiagrams(page)

  const rendered = preview.locator('.mermaid[data-processed="true"]')
  await expect(rendered).toHaveCount(1)
  // Mermaid replaces the node body with an SVG.
  await expect(rendered.locator('svg')).toHaveCount(1)
  await expect(failedCount(preview)).resolves.toBe(1)
})

async function failedCount(preview: import('@playwright/test').Locator) {
  return preview.locator('.mermaid-render-failure').count()
}
