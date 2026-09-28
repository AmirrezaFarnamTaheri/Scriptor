import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand } from './helpers'

/**
 * The graph header states an edge count, so that number has to be the number of
 * edges actually drawn. Both were true already; what was not true is that a
 * reciprocal pair could be told apart — its two directions sat closer together
 * than the arrowhead is wide, so the arrowheads overlapped and the pair read as
 * one edge. These assert the geometry directly, because a downscaled screenshot
 * cannot tell "two lines 18px apart" from "two lines 10px apart".
 */
async function openGraph(page: import('@playwright/test').Page) {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  await expect(page.getByRole('dialog', { name: 'Knowledge graph' })).toBeVisible()
  const svg = page.locator('svg.graph-canvas.force')
  await expect(svg).toBeVisible({ timeout: 30_000 })
  await expect(svg.locator('line.graph-edge').first()).toBeVisible()
  return svg
}

/** Perpendicular distance from point `p` to the infinite line through a→b. */
function perpendicularDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  return Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / length
}

test('every edge the graph reports is drawn, and reciprocal pairs stay separable', async ({ page }) => {
  const svg = await openGraph(page)

  const { declaredEdges, lines } = await svg.evaluate((root) => {
    const title = root.querySelector('title')?.textContent ?? ''
    return {
      declaredEdges: Number(/(\d+)\s+edges/.exec(title)?.[1] ?? '0'),
      lines: Array.from(root.querySelectorAll('line.graph-edge')).map((line) => ({
        source: line.getAttribute('data-edge-source') ?? '',
        target: line.getAttribute('data-edge-target') ?? '',
        x1: Number(line.getAttribute('x1')),
        y1: Number(line.getAttribute('y1')),
        x2: Number(line.getAttribute('x2')),
        y2: Number(line.getAttribute('y2')),
      })),
    }
  })

  // The seeded vault links Research Plan both ways with Field Notes and with
  // Methodology: two reciprocal pairs, four directed edges.
  expect(declaredEdges).toBe(4)
  expect(lines).toHaveLength(4)
  expect(lines.every((line) => line.source && line.target)).toBe(true)

  const markerWidth = Number(
    await svg.evaluate((root) => root.querySelector('#graph-arrow')?.getAttribute('markerWidth') ?? '0'),
  )
  expect(markerWidth).toBeGreaterThan(0)

  // Group by node pair, so a reciprocal pair is identified by which notes it
  // connects rather than by geometry — the layout can place two unrelated edges
  // almost collinear, which a geometric search happily mistakes for a pair.
  const pairs = new Map<string, typeof lines>()
  for (const line of lines) {
    const key = [line.source, line.target].sort().join('|')
    pairs.set(key, [...(pairs.get(key) ?? []), line])
  }
  const reciprocalPairs = [...pairs.values()].filter((group) => group.length === 2)
  expect(reciprocalPairs).toHaveLength(2)

  for (const [a, b] of reciprocalPairs) {
    // Each direction is offset along a shared, pair-canonical normal, so they end
    // up parallel. The gap between them has to clear the arrowhead: at or below
    // the marker width both arrowheads land on the same pixels, which is what made
    // a 4-edge graph read as 2 lines.
    const gap = perpendicularDistance(
      { x: a.x1, y: a.y1 },
      { x: b.x1, y: b.y1 },
      { x: b.x2, y: b.y2 },
    )
    expect(gap).toBeGreaterThan(markerWidth)
  }
})

test('node labels are masked so edge lines do not cross the glyphs', async ({ page }) => {
  const svg = await openGraph(page)

  const labels = await svg.evaluate((root) =>
    Array.from(root.querySelectorAll('text.graph-node-label')).map((text) => {
      const style = getComputedStyle(text)
      return {
        text: text.textContent,
        paintOrder: style.paintOrder,
        strokeWidth: style.strokeWidth,
      }
    }),
  )
  expect(labels.length).toBeGreaterThan(0)
  for (const label of labels) {
    // `paint-order: stroke` paints the surface-coloured stroke behind the fill,
    // punching a clear plate out of the line that would otherwise cross the text.
    expect(label.paintOrder).toBe('stroke')
    expect(Number.parseFloat(label.strokeWidth)).toBeGreaterThan(0)
  }
})
