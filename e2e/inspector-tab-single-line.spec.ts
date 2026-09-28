import { expect, test } from '@playwright/test'

import { launchApp, waitForWorkspace } from './helpers'

/**
 * The inspector tab row is a tablist: three tabs on one line. The 821–1100px band
 * used to set `white-space: normal` with `overflow-wrap: anywhere`, so `Rendered
 * output` broke onto two lines — `anywhere` even permits breaking inside a word —
 * which doubled the tab bar height and left the tabs on mismatched baselines.
 */
test('inspector tabs stay on one line across the tablet band', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await expect(page.locator('.inspector-tabs')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(500)

  for (const width of [1100, 1024, 900, 821]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(400)

    const tabs = page.locator('.inspector-tabs button[role="tab"]')
    await expect(tabs).toHaveCount(3)

    const geometry = await tabs.evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        // A wrapped label reports a box taller than one line of its own text.
        const lineHeight = Number.parseFloat(style.lineHeight || '0')
        return {
          text: (node.textContent ?? '').trim(),
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          whiteSpace: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          lineHeight: Math.round(lineHeight),
          // Truncated text scrolls horizontally inside the button.
          scrolls: node.scrollWidth > node.clientWidth + 1,
        }
      }),
    )

    for (const tab of geometry) {
      expect(tab.whiteSpace, `${tab.text} must not wrap at ${width}px`).toBe('nowrap')
      expect(tab.overflowWrap, `${tab.text} must not break mid-word at ${width}px`).not.toBe('anywhere')
    }

    // One visual line: every tab shares a baseline and none is taller than another
    // by more than the touch-target rounding.
    const tops = new Set(geometry.map((t) => t.top))
    expect(tops.size, `tabs on ${tops.size} lines at ${width}px`).toBe(1)
    const heights = new Set(geometry.map((t) => t.height))
    expect(heights.size, `tabs have mismatched heights at ${width}px`).toBe(1)

    // Equal-width flex columns gave every tab a third of the bar, so the longest
    // label truncated even when the row had room for all three. At 1024px and up
    // the inspector does have room, so nothing may be clipped there. Below that the
    // panel is genuinely too narrow and an ellipsis is the honest outcome — a
    // truncated label beats one wrapped across two lines, and the full name stays
    // on the accessible name either way.
    if (width >= 1024) {
      const truncated = geometry.filter((t) => t.scrolls).map((t) => t.text)
      expect(truncated, `labels truncated at ${width}px: ${truncated.join(', ')}`).toEqual([])
    }

    // And the row itself is one line tall, not doubled.
    const barHeight = await page.locator('.inspector-tabs').evaluate((n) => Math.round(n.getBoundingClientRect().height))
    expect(barHeight, `tab bar is ${barHeight}px at ${width}px`).toBeLessThanOrEqual(56)
  }
})

test('a truncated tab label still exposes its full name', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.waitForTimeout(400)

  const previewTab = page.locator('.inspector-tabs button[role="tab"]', { hasText: 'Rendered' })
  await expect(previewTab).toBeVisible()
  // The visible text may ellipsise, but the tab keeps the whole name for assistive
  // technology rather than announcing a fragment.
  const accessibleName = (await previewTab.textContent())?.trim() ?? ''
  expect(accessibleName).toBe('Rendered output')
})
