import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

/**
 * The note-history comparison showed two static raw Markdown blocks and nothing
 * about what actually changed. It now derives a line-level diff and its
 * +/− counts from the two texts it already has — no author, source, or git
 * metadata is invented — while keeping both raw panes available.
 */
async function openHistory(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  // `openCommandPalette` opens the palette; `runCommand` then fills and clicks,
  // asserting the option it activates really is the requested command. Driving the
  // palette by hand leaves the modal backdrop intercepting the click.
  await openCommandPalette(page)
  await runCommand(page, 'Note history timeline')
  const panel = page.getByRole('dialog', { name: 'Note history' })
  await expect(panel).toBeVisible({ timeout: 20_000 })
  // Revisions are what the diff is computed from, so wait for at least one.
  await expect(panel.getByText(/words/)).toBeVisible({ timeout: 20_000 })
  return panel
}

/** Ensures a revision is selected, so the comparison has both sides loaded. */
async function selectRevision(page: Page, panel: ReturnType<typeof page.getByRole>) {
  const summary = panel.locator('.note-history-diff-summary')
  if (await summary.isVisible().catch(() => false)) return
  const first = panel.locator('.note-history-timeline button').first()
  await expect(first).toBeVisible({ timeout: 20_000 })
  await first.click({ timeout: 20_000 })
  await expect(summary).toBeVisible({ timeout: 20_000 })
}

test('the comparison reports change counts and marks the differing lines', async ({ page }) => {
  const panel = await openHistory(page)

  await selectRevision(page, panel)

  const summary = panel.locator('.note-history-diff-summary')
  await expect(summary).toBeVisible({ timeout: 20_000 })
  await expect(panel.locator('.note-history-diff-added')).toBeVisible()
  await expect(panel.locator('.note-history-diff-removed')).toBeVisible()

  // The counts and the per-line marks must agree.
  const counts = await panel.evaluate(() => {
    const read = (sel: string) =>
      Number((document.querySelector(sel)?.textContent ?? '').replace(/[^\d-]/g, ''))
    return {
      added: read('.note-history-diff-added'),
      removed: read('.note-history-diff-removed'),
      addLines: document.querySelectorAll('.note-history-diff-line.is-add').length,
      removeLines: document.querySelectorAll('.note-history-diff-line.is-remove').length,
    }
  })
  expect(counts.added).toBe(counts.addLines)
  expect(counts.removed).toBe(counts.removeLines)

  // Additions and removals are distinguished by a glyph as well as by colour, so
  // the difference does not rely on colour alone.
  const markers = await panel.evaluate(() =>
    Array.from(document.querySelectorAll('.note-history-diff-line.is-add .note-history-diff-marker'))
      .slice(0, 3)
      .map((n) => (n.textContent ?? '').trim()),
  )
  for (const marker of markers) expect(marker).toBe('+')
})

test('the raw Markdown panes stay available alongside the diff', async ({ page }) => {
  const panel = await openHistory(page)
  await selectRevision(page, panel)

  // Both raw versions are still on screen, not replaced by the diff.
  await expect(panel.locator('.note-history-current-markdown')).toBeVisible()
  await expect(panel.locator('.note-history-revision-markdown')).toBeVisible()

  // And the diff can be put away without losing them.
  await panel.getByRole('button', { name: 'Hide changes' }).click()
  await expect(panel.locator('.note-history-diff')).toHaveCount(0)
  await expect(panel.locator('.note-history-current-markdown')).toBeVisible()
  await expect(panel.locator('.note-history-revision-markdown')).toBeVisible()

  // And brought back.
  await panel.getByRole('button', { name: 'Show changes' }).click()
  await expect(panel.locator('.note-history-diff')).toHaveCount(1)
})

test('the per-line diff is not read out twice by assistive technology', async ({ page }) => {
  const panel = await openHistory(page)
  await selectRevision(page, panel)

  // The counts carry the meaning; the line list is decoration over the two raw
  // panes, which are themselves readable.
  const hidden = await panel.locator('.note-history-diff').getAttribute('aria-hidden')
  expect(hidden).toBe('true')

  // The counts are still exposed as text, so the change is not hidden from anyone.
  await expect(panel.locator('.note-history-diff-summary')).toBeVisible()
})
