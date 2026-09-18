import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('canvas zoom controls stay together', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open canvas')
  const controls = page.getByRole('group', { name: 'Canvas view controls' })
  await expect(controls).toBeVisible()
  const minus = await controls.getByRole('button', { name: 'Zoom out' }).boundingBox()
  const plus = await controls.getByRole('button', { name: 'Zoom in' }).boundingBox()
  expect(minus).not.toBeNull()
  expect(plus).not.toBeNull()
  expect(plus!.x - (minus!.x + minus!.width)).toBeLessThan(100)
})

test('graph view select matches toolbar sizing', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const select = page.getByRole('dialog', { name: 'Knowledge graph' }).getByRole('combobox', { name: 'View' })
  await expect(select).toBeVisible()
  // Gate on computed layout metrics, not getBoundingClientRect: the docked panel
  // runs an open animation that leaves a transient transform scale on
  // .unified-panel-shell, so the rendered box can read ~0.95x-1.0x of its real
  // size if it is measured mid-flight. min-height and border-radius are
  // scale-invariant, and they are exactly what separate a themed 32px control
  // from the unstyled native chrome this control used to be (min-height
  // "auto", no radius).
  const themed = await select.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      borderRadius: Number.parseFloat(style.borderRadius),
      minHeight: Number.parseFloat(style.minHeight),
    }
  })
  expect(themed.borderRadius).toBeGreaterThan(0)
  expect(themed.minHeight).toBeGreaterThanOrEqual(32)
})

test('Git pull strategy is a sized themed control', async ({ page }) => {
  await launchApp(page)
  await page.locator('.top-actions .status-button').first().click()
  const select = page.locator('.git-panel').getByRole('combobox', { name: 'Pull strategy', exact: true })
  await expect(select).toBeVisible()
  const themed = await select.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      borderRadius: Number.parseFloat(style.borderRadius),
      minHeight: Number.parseFloat(style.minHeight),
    }
  })
  expect(themed.borderRadius).toBeGreaterThan(0)
  expect(themed.minHeight).toBeGreaterThanOrEqual(32)
})

test('conflict close button stays beside the heading', async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem('e2e:git-conflicts', '1'))
  await launchApp(page)
  await page.locator('.top-actions .status-button').first().click()
  await page.locator('.git-panel').getByRole('button', { name: /resolve/i }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Resolve merge conflicts' })
  await expect(dialog).toBeVisible()
  const heading = await dialog.getByRole('heading', { name: 'Resolve merge conflicts' }).boundingBox()
  const close = await dialog.getByRole('button', { name: 'Close', exact: true }).boundingBox()
  expect(heading).not.toBeNull()
  expect(close).not.toBeNull()
  expect(close!.x).toBeGreaterThan(heading!.x + heading!.width)
  expect(Math.abs(close!.y - heading!.y)).toBeLessThan(32)
})
