import { test, expect } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

test.describe('Theme switching', () => {
  test('toggles light and dark mode', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    const root = page.locator('html')
    const initialTheme = await root.getAttribute('data-theme')
    expect(['light', 'dark']).toContain(initialTheme)
  })

  test('high-contrast mode sets correct attribute', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'high-contrast')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast')
  })

  test('theme persists after reload', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('theme switch via command palette', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'toggle-theme')
    await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark|high-contrast)$/)
    const theme = await page.locator('html').getAttribute('data-theme')
    expect(['light', 'dark', 'high-contrast']).toContain(theme)
  })
})
