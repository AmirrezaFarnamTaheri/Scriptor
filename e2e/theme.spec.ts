import { test, expect } from '@playwright/test'
import { launchApp, settleLayout } from './helpers'

test.describe('Palette and appearance switching', () => {
  test('night/day toggle keeps the selected palette', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'catppuccin')
      window.localStorage.setItem('scriptor:appearance-mode', 'light')
    })
    await launchApp(page, { theme: 'catppuccin' })
    await settleLayout(page)
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-theme', 'catppuccin')
    await expect(root).toHaveAttribute('data-palette', 'catppuccin')
    await expect(root).toHaveAttribute('data-appearance', 'light')

    await page.getByRole('button', { name: /Switch to dark theme/i }).click()
    await expect(root).toHaveAttribute('data-theme', 'catppuccin')
    await expect(root).toHaveAttribute('data-palette', 'catppuccin')
    await expect(root).toHaveAttribute('data-appearance', 'dark')

    await page.getByRole('button', { name: /Switch to light theme/i }).click()
    await expect(root).toHaveAttribute('data-theme', 'catppuccin')
    await expect(root).toHaveAttribute('data-appearance', 'light')
  })

  test('appearance and palette persist independently after reload', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'nord')
      window.localStorage.setItem('scriptor:appearance-mode', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-theme', 'nord')
    await expect(root).toHaveAttribute('data-appearance', 'dark')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(root).toHaveAttribute('data-theme', 'nord')
    await expect(root).toHaveAttribute('data-appearance', 'dark')
  })

  test('legacy stored palette migrates to an independent appearance', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'sepia-paper')
      window.localStorage.removeItem('scriptor:appearance-mode')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-theme', 'sepia-paper')
    await expect(root).toHaveAttribute('data-appearance', 'light')
  })
})
