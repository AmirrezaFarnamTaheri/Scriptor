import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

test('bibliography evidence includes real source metadata and an active CSL preview', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Browse bibliography')
  const panel = page.getByRole('dialog', { name: 'Bibliography', exact: true })
  await expect(panel.locator('.bibliography-list > li small')).toHaveText('references.bib · article')
  await expect(panel.locator('header')).toContainText('CSL preview')
  await expect(panel.getByText('smith2024', { exact: true })).toBeVisible()
})

test('empty bibliography metadata produces no separator-only row', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('e2e:bibliography-empty-metadata', '1'))
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Browse bibliography')
  const panel = page.getByRole('dialog', { name: 'Bibliography', exact: true })
  await expect(panel.getByText('smith2024', { exact: true })).toBeVisible()
  await expect(panel.locator('.bibliography-list > li small')).toHaveCount(0)
  await expect(panel.locator('.bibliography-list > li > button')).toContainText('Research Methods')
})
