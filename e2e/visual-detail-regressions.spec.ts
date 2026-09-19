import { expect, test } from '@playwright/test'
import { launchApp, settleLayout } from './helpers'
import { COLOR_PALETTE_SCHEMES } from '../src/brand/palettes'

test('all built-in palettes preserve the selected night appearance on native controls', async ({ page }) => {
  await launchApp(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
  const appearance = settings.getByRole('combobox', { name: 'Day / night appearance', exact: true })
  const select = settings.getByRole('combobox', { name: 'Color palette', exact: true })
  await appearance.selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
  for (const palette of COLOR_PALETTE_SCHEMES) {
    await select.selectOption(palette.id)
    await expect(page.locator('html')).toHaveAttribute('data-palette', palette.id)
    await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
    await settleLayout(page)
    await select.focus()
    const style = await select.evaluate(element => ({
      scheme: getComputedStyle(element).colorScheme,
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor,
      height: element.getBoundingClientRect().height,
      shadow: getComputedStyle(element).boxShadow,
    }))
    expect(style.scheme, palette.id).toBe('dark')
    expect(style.color, palette.id).not.toBe(style.background)
    expect(style.height, palette.id).toBeGreaterThanOrEqual(44)
    expect(style.shadow, palette.id).not.toBe('none')
    await page.screenshot({ path: test.info().outputPath(`appearance-${palette.id}.png`) })
  }
})

// Regression for the settings appearance controls: selects previously fell
// back to short native browser chrome because the shared field rule only
// targeted inputs. They must match input sizing, radius, and focus ring.
test('appearance selects share input sizing and keyboard focus', async ({ page }) => {
  await launchApp(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
  const select = settings.getByRole('combobox', { name: 'Color palette', exact: true })
  await select.scrollIntoViewIfNeeded()
  await select.focus()
  await expect(select).toBeFocused()
  const style = await select.evaluate(element => ({
    height: element.getBoundingClientRect().height,
    radius: getComputedStyle(element).borderRadius,
    shadow: getComputedStyle(element).boxShadow,
  }))
  expect(style.height).toBeGreaterThanOrEqual(44)
  expect(style.radius).not.toBe('0px')
  expect(style.shadow).not.toBe('none')
})


test('appearance and workspace tabs keep separate ownership', async ({ page }) => {
  await launchApp(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })

  await settings.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await expect(settings.getByRole('combobox', { name: 'Color palette', exact: true })).toBeVisible()
  await expect(settings.getByRole('checkbox', { name: 'Show top navigation header' })).toHaveCount(0)

  await settings.getByRole('tab', { name: 'Workspace', exact: true }).click()
  await expect(settings.getByRole('heading', { name: 'Workspace chrome', exact: true })).toBeVisible()
  await expect(settings.getByRole('checkbox', { name: 'Show top navigation header' })).toBeVisible()
})
