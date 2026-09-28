import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

/**
 * Every export profile has to be reachable in one continuous list. The list used to
 * carry its own `max-height` + `overflow-y` inside a panel body that already
 * scrolls, so it became a nested scroll: a card was cut through mid-badge with no
 * affordance, and two of the six profiles sat entirely below the inner fold. The
 * panel body is the only thing that should scroll.
 */
async function openPublishCenter(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open publish center')
  const dialog = page.getByRole('dialog', { name: 'Export & publish' })
  await expect(dialog).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)
  return dialog
}

test('every export profile sits in the panel scroll, not a nested one', async ({ page }) => {
  const dialog = await openPublishCenter(page)
  const list = page.locator('.publish-profile-list')

  // The seeded vault ships six profiles: HTML, PDF, DOCX, LaTeX, ePub, Reveal.js.
  const cards = list.locator('li')
  await expect(cards).toHaveCount(6)

  const geometry = await list.evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    overflowY: getComputedStyle(node).overflowY,
  }))

  // No inner scroller: if the list cannot show its own content, the panel body
  // scrolls instead and every card is reachable by scrolling the dialog once.
  expect(
    geometry.scrollHeight,
    '.publish-profile-list must not be its own scroll container',
  ).toBeLessThanOrEqual(geometry.clientHeight + 1)

  // Each card must be whole, not sliced by a scroll boundary: a card whose height is
  // clipped is the visible symptom of the nested scroll.
  const clipped = await cards.evaluateAll((nodes) =>
    nodes
      .filter((n) => n.scrollHeight > n.clientHeight + 1)
      .map((n) => (n.textContent ?? '').trim().slice(0, 24)),
  )
  expect(clipped, 'no export profile card may be clipped').toEqual([])

  // And the panel body is the thing that actually scrolls.
  const body = dialog.locator('.unified-panel-body')
  await expect(body).toBeVisible()
  const bodyOverflow = await body.evaluate((n) => getComputedStyle(n).overflowY)
  expect(['auto', 'scroll']).toContain(bodyOverflow)
})

test('the non-applicable LaTeX engine does not displace the profile list', async ({ page }) => {
  const dialog = await openPublishCenter(page)

  // The active note is a Markdown file, so Tectonic cannot run. Its section may
  // still be present and discoverable, but it must come after the profile list
  // rather than pushing profiles out of view.
  const listBeforeLatex = await dialog.evaluate((root) => {
    const list = root.querySelector('.publish-profile-list')
    const latexHeading = root.querySelector('#latex-compile-heading')
    if (!list || !latexHeading) return null
    // `DOCUMENT_POSITION_FOLLOWING` means latexHeading comes after list.
    return Boolean(
      list.compareDocumentPosition(latexHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
  expect(listBeforeLatex, 'export profiles must precede the LaTeX engine section').toBe(true)

  // The disabled primary action must not be the only thing in that section: the
  // discoverability control stays reachable.
  await expect(dialog.getByRole('button', { name: /Detect Tectonic|Tectonic (detected|not found)/ })).toBeVisible()
})
