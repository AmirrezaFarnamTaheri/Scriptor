import { test, expect } from '@playwright/test'
import { launchApp, settleLayout } from './helpers'

// The top-bar theme control cycles light -> dark -> high-contrast -> light
// (see src/hooks/useAppTheme.ts THEME_CYCLE). Its accessible name advertises
// the *next* theme, so it changes as the theme changes.
const TOGGLE_NAMES = {
  light: 'Switch to dark theme',
  dark: 'Switch to high-contrast theme',
  'high-contrast': 'Switch to light theme',
} as const

test.describe('Theme switching', () => {
  test('toggles light and dark mode', async ({ page }) => {
    await launchApp(page, { theme: 'light' })
    await settleLayout(page)
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-theme', 'light')

    await page.getByRole('button', { name: TOGGLE_NAMES.light, exact: true }).click()
    await expect(root).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('button', { name: TOGGLE_NAMES.dark, exact: true }).click()
    await expect(root).toHaveAttribute('data-theme', 'high-contrast')

    await page.getByRole('button', { name: TOGGLE_NAMES['high-contrast'], exact: true }).click()
    await expect(root).toHaveAttribute('data-theme', 'light')
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

  // Renamed from "theme switch via command palette": there is no `toggle-theme`
  // palette command (the palette matches on visible labels and no theme command
  // is registered in src/lib/buildPaletteCommands.ts), so the old test could
  // only ever have exercised the top-bar control it never clicked.
  test('toggling the theme changes and persists the applied theme', async ({ page }) => {
    await launchApp(page, { theme: 'dark' })
    await settleLayout(page)
    const root = page.locator('html')
    const before = await root.getAttribute('data-theme')
    expect(before).toBe('dark')

    await page.getByRole('button', { name: TOGGLE_NAMES.dark, exact: true }).click()
    const after = await root.getAttribute('data-theme')
    expect(after).not.toBe(before)
    expect(after).toBe('high-contrast')

    await page.reload({ waitUntil: 'networkidle' })
    await expect(root).toHaveAttribute('data-theme', 'high-contrast')
  })
})
