import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

test('phone navigation prioritizes notes and writing, with accessible secondary destinations', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.setViewportSize({ width: 320, height: 740 })
  const navigation = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
  await expect(navigation.locator('button')).toHaveCount(4)
  await expect(navigation.getByRole('button', { name: 'Command', exact: true })).toBeVisible()
  await navigation.getByRole('button', { name: 'More' }).click()
  const more = page.getByRole('group', { name: 'More destinations' })
  await expect(more.getByRole('button', { name: 'Inspector' })).toBeVisible()
  await expect(more.getByRole('button', { name: 'Plugins' })).toBeVisible()
  await more.getByRole('button', { name: 'Inspector' }).click()
  await expect(more).toHaveCount(0)
  await navigation.getByRole('button', { name: 'More' }).click()
  await more.getByRole('button', { name: 'Plugins' }).click()
  await expect(more).toHaveCount(0)
})

test('source editor fills the document workspace and returns to writing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Source file editor')
  const dock = page.locator('.workspace-leaf-dock')
  await expect(dock).toHaveClass(/is-focused-workspace/)
  const source = dock.getByRole('region', { name: 'Source file editor' })
  await expect(source).toBeVisible()
  const widths = await dock.evaluate(node => {
    const panel = node.querySelector('.workspace-leaf-content.secondary')
    return { outer: node.getBoundingClientRect().width, inner: panel?.getBoundingClientRect().width ?? 0 }
  })
  expect(widths.inner).toBeGreaterThan(widths.outer * 0.8)
  await dock.getByRole('button', { name: 'Back to writing' }).click()
  await expect(dock).not.toHaveClass(/is-focused-workspace/)
  await expect(dock.locator('.workspace-writing-leaf')).toBeVisible()
})
