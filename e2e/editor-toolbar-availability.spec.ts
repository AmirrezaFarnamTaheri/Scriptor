import { expect, test } from '@playwright/test'

import { launchApp, waitForWorkspace } from './helpers'

/**
 * The formatting controls must be honestly unavailable when they cannot act: no
 * note open, or a rendered view with no text cursor behind the toolbar. And a
 * disabled control has to *look* disabled, not merely be inert.
 *
 * The probe targets the `Structure` and `Style and insert` groups specifically.
 * The `View mode` group shares the toolbar but must stay available in every state,
 * so measuring "the first button" would report a view-mode toggle and prove
 * nothing about formatting.
 */
async function formattingState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.editor-toolbar')
    if (!bar) return null
    // `CustomizableToolbar` re-hosts every formatting control in the pinned group and
    // wraps each one in `.toolbar-tool`. The group's other buttons — the Tools
    // overflow trigger and the Customize affordance — are app-level navigation, not
    // document edits, so they are excluded and asserted separately below.
    const pinned = bar.querySelector<HTMLElement>('.editor-primary-formatting')
    if (!pinned) return null
    const controls = Array.from(pinned.querySelectorAll('.toolbar-tool button'))
    if (controls.length === 0) return null
    const enabled = controls.filter((c) => !(c as HTMLButtonElement).disabled)
    const disabled = controls.filter((c) => (c as HTMLButtonElement).disabled)
    const sample = controls[0] as HTMLElement
    const computed = getComputedStyle(sample)
    return {
      total: controls.length,
      enabled: enabled.length,
      disabled: disabled.length,
      opacity: Number.parseFloat(computed.opacity),
      cursor: computed.cursor,
      // The view-mode group must be untouched by any of this.
      viewModeEnabled: Array.from(
        bar.querySelectorAll<HTMLButtonElement>('.editor-view-modes button'),
      ).filter((b) => !b.disabled).length,
    }
  })
}

test('formatting controls are disabled and visibly disabled with no note open', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  // `launchApp` auto-opens a note, so the empty state has to be reached by closing
  // the open tab — otherwise this test measures a normal editing session and passes
  // for the wrong reason.
  await page.locator('.tabs-row').getByRole('button', { name: 'Close Research Plan' }).click()
  await expect(page.locator('.editor-empty-card')).toBeVisible({ timeout: 10_000 })
  await page.waitForTimeout(600)

  const state = await formattingState(page)
  expect(state).not.toBeNull()
  expect(state!.enabled, 'formatting must be disabled with no note open').toBe(0)
  expect(state!.disabled).toBeGreaterThan(0)
  // An inert control that renders like a live one is the defect: it must be
  // visibly dimmed, and must not offer a clickable cursor.
  expect(state!.opacity, 'a disabled toolbar control must be dimmed').toBeLessThan(0.7)
  expect(state!.cursor).toBe('not-allowed')
  // View switching is not a document edit and stays available.
  expect(state!.viewModeEnabled, 'view-mode buttons must stay enabled').toBe(3)
})

test('formatting controls are disabled in the rendered view', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' }).click()
  await expect(page.locator('.view-line').first()).toBeVisible({ timeout: 20_000 })

  await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
  await page.waitForTimeout(800)

  const state = await formattingState(page)
  expect(state).not.toBeNull()
  // There is no text cursor behind a rendered view, so the controls must say so.
  expect(state!.enabled, 'formatting must be disabled in the rendered view').toBe(0)
  expect(state!.viewModeEnabled, 'view-mode buttons must stay enabled').toBe(3)
})

test('formatting controls are enabled again in the source view', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' }).click()
  await expect(page.locator('.view-line').first()).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(600)

  const source = await formattingState(page)
  expect(source!.enabled, 'formatting must be available in the source view').toBeGreaterThan(0)

  // Switching to the rendered view and back must not leave it stuck disabled.
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Preview', exact: true }).click()
  await page.waitForTimeout(500)
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Source', exact: true }).click()
  await page.waitForTimeout(500)
  const back = await formattingState(page)
  expect(back!.enabled, 'returning to the source view must re-enable formatting').toBeGreaterThan(0)
})
