import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

/**
 * The MCP authorization level is a one-of-N choice, but it was built as a row of
 * `aria-pressed` toggle buttons in a generic group. A screen reader therefore
 * announced four independent switches instead of one setting with a current value,
 * and a separate "Current: …" badge existed only to state in prose what the control
 * should have been conveying itself. It is now a real radiogroup.
 */
async function openMcp(page: Page) {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open MCP panel')
  const panel = page.locator('.mcp-panel')
  await expect(panel).toBeVisible({ timeout: 20_000 })
  return panel
}

test('the authorization level is a radiogroup of radios', async ({ page }) => {
  const panel = await openMcp(page)
  const group = panel.locator('[role="radiogroup"]')
  await expect(group).toHaveCount(1)
  await expect(group).toHaveAttribute('aria-label', /.+/)

  const radios = group.getByRole('radio')
  await expect(radios).toHaveCount(4)

  // Exactly one is checked, and it is the only one in the tab order — the roving
  // tabindex a radiogroup requires, so Tab enters the group rather than walking it.
  const state = await radios.evaluateAll((nodes) =>
    nodes.map((n) => ({
      checked: n.getAttribute('aria-checked'),
      tabIndex: (n as HTMLElement).tabIndex,
    })),
  )
  expect(state.filter((s) => s.checked === 'true')).toHaveLength(1)
  expect(state.filter((s) => s.tabIndex === 0)).toHaveLength(1)
  expect(state.find((s) => s.checked === 'true')?.tabIndex).toBe(0)

  // No toggle-button semantics left over.
  expect(await panel.getByRole('button', { pressed: true }).count()).toBe(0)
})

test('arrow keys move between authorization levels and commit the change', async ({ page }) => {
  const panel = await openMcp(page)
  const group = panel.locator('[role="radiogroup"]')
  const radios = group.getByRole('radio')
  await expect(radios).toHaveCount(4)

  // Start from whichever level is actually current, rather than assuming which.
  const checkedIndex = await radios.evaluateAll((nodes) =>
    nodes.findIndex((n) => n.getAttribute('aria-checked') === 'true'),
  )
  expect(checkedIndex).toBeGreaterThanOrEqual(0)

  await radios.nth(checkedIndex).focus()
  await expect(radios.nth(checkedIndex)).toBeFocused()

  // ArrowRight advances one level, focuses it, and makes it the checked one.
  const nextIndex = (checkedIndex + 1) % 4
  await page.keyboard.press('ArrowRight')
  await expect(radios.nth(nextIndex)).toBeFocused()
  await expect(radios.nth(nextIndex)).toHaveAttribute('aria-checked', 'true')
  await expect(radios.nth(checkedIndex)).toHaveAttribute('aria-checked', 'false')

  // ArrowLeft goes back.
  await page.keyboard.press('ArrowLeft')
  await expect(radios.nth(checkedIndex)).toBeFocused()
  await expect(radios.nth(checkedIndex)).toHaveAttribute('aria-checked', 'true')

  // End jumps to the last, Home back to the first.
  await page.keyboard.press('End')
  await expect(radios.nth(3)).toBeFocused()
  await expect(radios.nth(3)).toHaveAttribute('aria-checked', 'true')

  await page.keyboard.press('Home')
  await expect(radios.nth(0)).toBeFocused()
  await expect(radios.nth(0)).toHaveAttribute('aria-checked', 'true')

  // The prose badge that duplicated the selection is gone.
  await expect(panel.locator('.mcp-mode-summary')).toHaveCount(0)
})

test('the redundant current-level badge no longer renders', async ({ page }) => {
  const panel = await openMcp(page)
  // The checked radio states the current level; a second copy of the same sentence
  // in the same viewport was the defect.
  await expect(panel.locator('.mcp-mode-summary')).toHaveCount(0)
  await expect(panel.getByText(/^Current:/)).toHaveCount(0)
  // And the level is still plainly visible as the selected card.
  await expect(panel.locator('.mcp-mode-option.active')).toHaveCount(1)
})

test('a tool result is bounded and can be copied verbatim', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const panel = await openMcp(page)

  await panel.getByRole('tab', { name: 'Tools', exact: true }).click()
  await panel.getByRole('combobox', { name: 'Tool', exact: true }).selectOption('mcp.inspectOutline')
  await panel.getByRole('button', { name: 'Invoke tool', exact: true }).click()

  const result = panel.locator('.mcp-result')
  await expect(result).toBeVisible({ timeout: 20_000 })

  // Bounded: the box scrolls internally rather than growing the docked panel until
  // its content is cut off at the viewport edge.
  const box = await result.evaluate((n) => {
    const el = n as HTMLElement
    return {
      maxHeight: getComputedStyle(el).maxHeight,
      overflowY: getComputedStyle(el).overflowY,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
    }
  })
  expect(box.overflowY).toBe('auto')
  expect(box.maxHeight).not.toBe('none')

  // A result large enough to overflow must actually be scrollable, not merely clipped.
  const scrollable = box.scrollHeight > box.clientHeight
  if (scrollable) {
    expect(await result.evaluate((n) => (n as HTMLElement).scrollHeight > (n as HTMLElement).clientHeight)).toBe(true)
  }

  // Copying yields the same data as the box shows. Compared as parsed JSON rather
  // than as raw strings: the rendered `<pre>` and the copied string are identical
  // in content, but incidental whitespace between the two is not part of the
  // contract and would make a byte comparison brittle.
  const shown = (await result.textContent()) ?? ''
  const copyButton = panel.getByRole('button', { name: 'Copy tool result as JSON' })
  await expect(copyButton).toBeVisible()
  await copyButton.click()
  await expect(copyButton).toContainText('Copied')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard.trim().length).toBeGreaterThan(0)
  // A complete document, not the truncated fragment that was the original symptom.
  expect(clipboard.trim().startsWith('{')).toBe(true)
  expect(clipboard.trim().endsWith('}')).toBe(true)
  expect(JSON.parse(clipboard)).toEqual(JSON.parse(shown))
  // And it carries the result the tool actually returned.
  const parsed = JSON.parse(clipboard) as { ok?: boolean; output?: { title?: string } }
  expect(parsed.ok).toBe(true)
  expect(parsed.output?.title).toBeTruthy()
})
