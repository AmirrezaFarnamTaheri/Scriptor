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

  test('palette identity visibly tints both day and night surfaces', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'catppuccin')
      window.localStorage.setItem('scriptor:appearance-mode', 'light')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const root = page.locator('html')
    const body = page.locator('body')
    const catppuccinLight = await body.evaluate((element) => getComputedStyle(element).backgroundColor)

    await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
    await settings.getByRole('combobox', { name: 'Color palette', exact: true }).selectOption('nord')
    await expect(root).toHaveAttribute('data-palette', 'nord')
    const nordLight = await body.evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(nordLight).not.toBe(catppuccinLight)
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()

    await page.getByRole('button', { name: /Switch to dark theme/i }).click()
    await expect(root).toHaveAttribute('data-palette', 'nord')
    const nordDark = await body.evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(nordDark).not.toBe(nordLight)
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
