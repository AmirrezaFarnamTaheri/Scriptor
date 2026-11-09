import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

test('marketplace finds an already-installed plugin and hides installed-only status', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.getByRole('tab', { name: 'Tools', exact: true }).click()
  const store = page.locator('.store-root')
  await store.getByRole('tab', { name: 'Browse plugins' }).click()
  await store.getByRole('searchbox', { name: 'Search plugins' }).fill('gmail')
  const browse = store.getByRole('tabpanel', { name: 'Browse plugins' })
  await expect(browse).toContainText('Gmail Manager')
  await expect(browse).toContainText('Already installed')
  await expect(store.locator('.store-banner')).toBeHidden()
  await expect(store.locator('.store-lint-summary')).toBeHidden()
})

test('last onboarding step has one primary action and no competing footer links at 200% zoom', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('scriptor:onboarding-complete', 'false'))
  await page.setViewportSize({ width: 375, height: 720 })
  await launchApp(page)
  const tour = page.getByRole('dialog', { name: 'Product tour' })
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Next' }).click()
  await tour.getByRole('button', { name: 'Next' }).click()
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const footer = tour.locator('.onboarding-actions')
  await expect(footer.locator('button')).toHaveCount(3)
  await expect(footer.getByRole('button', { name: 'Finish' })).toBeVisible()
})
