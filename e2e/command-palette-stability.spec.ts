import { expect, test } from '@playwright/test'

import { appendEditorLine, launchApp, openCommandPalette, waitForWorkspace } from './helpers'

test.beforeEach(async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
})

test('command palette search field stays geometrically stable while typing and note search settles', async ({ page }) => {
  await openCommandPalette(page)
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  const search = palette.getByRole('searchbox')
  const header = palette.locator('.command-palette-header')

  await expect(search).toHaveAttribute('type', 'text')
  const baseline = await search.boundingBox()
  expect(baseline).not.toBeNull()

  for (const query of ['g', 'gr', 'gra', 'graph']) {
    await search.fill(query)
    await page.waitForTimeout(260)
    const next = await search.boundingBox()
    expect(next).not.toBeNull()
    expect(Math.abs((next?.x ?? 0) - (baseline?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((next?.y ?? 0) - (baseline?.y ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((next?.width ?? 0) - (baseline?.width ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs((next?.height ?? 0) - (baseline?.height ?? 0))).toBeLessThanOrEqual(1)
  }

  const paint = await header.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    paletteBackdrop: getComputedStyle(element.parentElement!).backdropFilter,
  }))
  expect(paint.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(paint.paletteBackdrop).toBe('none')
})

test('top-bar command entry remains stable across editor draft updates', async ({ page }) => {
  const commandEntry = page.locator('.command-search')
  const baseline = await commandEntry.boundingBox()
  expect(baseline).not.toBeNull()

  const background = await commandEntry.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')

  await appendEditorLine(page, 'command-search-flicker-regression')
  await page.waitForTimeout(900)

  const next = await commandEntry.boundingBox()
  expect(next).not.toBeNull()
  expect(Math.abs((next?.x ?? 0) - (baseline?.x ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((next?.y ?? 0) - (baseline?.y ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((next?.width ?? 0) - (baseline?.width ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((next?.height ?? 0) - (baseline?.height ?? 0))).toBeLessThanOrEqual(1)
})
