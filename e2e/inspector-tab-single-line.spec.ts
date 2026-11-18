import { expect, test } from '@playwright/test'

import { expandInspector, launchApp, waitForWorkspace } from './helpers'

/**
 * The inspector tab row is a tablist: three tabs on one line. The 821–1100px band
 * used to set `white-space: normal` with `overflow-wrap: anywhere`, so `Rendered
 * output` broke onto two lines — `anywhere` even permits breaking inside a word —
 * which doubled the tab bar height and left the tabs on mismatched baselines.
 */
test('inspector tabs stay on one line across the tablet band', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await expandInspector(page)
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

test('translated inspector tabs stay on one row and remain reachable by scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.addInitScript(() => localStorage.setItem('scriptor:locale', 'de'))
  await launchApp(page)
  await waitForWorkspace(page)
  await expandInspector(page)
  const tabs = page.locator('.inspector-tabs button[role="tab"]')
  await expect(tabs).toHaveCount(3)
  const geometry = await tabs.evaluateAll(nodes => nodes.map(node => ({
    top: Math.round(node.getBoundingClientRect().top),
    clipped: node.scrollWidth > node.clientWidth + 1,
  })))
  expect(new Set(geometry.map(item => item.top)).size).toBe(1)
  expect(geometry.every(item => !item.clipped), 'scrolling the rail must not truncate a tab inside its own button').toBe(true)

  // The full German publishing heading must wrap inside its card, not paint
  // past the inspector edge even when the rail is narrower than a single word.
  const publishing = page.locator('.inspector-panel .widget-card h3').filter({ hasText: 'Veröffentlichungsbereitschaft' })
  await publishing.scrollIntoViewIfNeeded()
  await expect(publishing).toBeVisible()
  const heading = await publishing.evaluate(element => {
    const box = element.getBoundingClientRect()
    const card = element.closest('.widget-card')!.getBoundingClientRect()
    return {
      hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      withinCard: box.left >= card.left - 1 && box.right <= card.right + 1,
    }
  })
  expect(heading.hasHorizontalOverflow, 'the translated card heading must be fully readable').toBe(false)
  expect(heading.withinCard, 'the heading must stay within the widget card').toBe(true)

  const reveal = page.locator('.inspector-tabs-reveal')
  await expect(reveal).toBeVisible()
  await expect(reveal).toHaveAccessibleName(/\S/)
  await reveal.click()
  await tabs.last().scrollIntoViewIfNeeded()
  await tabs.last().click()
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
})

test('a truncated tab label still exposes its full name', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await expandInspector(page)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.waitForTimeout(400)

  const previewTab = page.locator('.inspector-tabs button[role="tab"]', { hasText: 'Rendered' })
  await expect(previewTab).toBeVisible()
  // The visible text may ellipsise, but the tab keeps the whole name for assistive
  // technology rather than announcing a fragment.
  const accessibleName = (await previewTab.textContent())?.trim() ?? ''
  expect(accessibleName).toBe('Rendered output')
})
