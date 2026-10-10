import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('offline weekly planner maps tasks to time blocks, retains them after restart and removes locally', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open tasks panel')
  const planner = page.getByRole('region', { name: 'Weekly planner', exact: true })
  await expect(planner).toBeVisible()
  await planner.getByLabel('Week containing').fill('2026-10-01')
  await planner.getByRole('combobox', { name: 'Vault task', exact: true }).selectOption({ label: 'Collect sources' })
  await planner.getByLabel('Start', { exact: true }).fill('2026-10-01T09:00')
  await planner.getByLabel('End', { exact: true }).fill('2026-10-01T10:00')
  await planner.getByRole('button', { name: 'Save time block', exact: true }).click()
  const block = planner.getByRole('listitem', { name: '2026-10-01', exact: true }).getByRole('button', { name: /Collect sources/ })
  await expect(block).toBeVisible()
  await expect(planner.getByRole('button', { name: 'Review bidirectional sync', exact: true })).toBeDisabled()
  await page.reload()
  await openCommandPalette(page)
  await runCommand(page, 'Open tasks panel')
  await planner.getByLabel('Week containing').fill('2026-10-01')
  await expect(block).toBeVisible()
  await page.setViewportSize({ width: 320, height: 800 })
  await page.locator('html').evaluate(node => { node.setAttribute('dir', 'rtl') })
  await expect.poll(() => planner.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  await block.click()
  await expect(planner.getByRole('combobox', { name: 'Vault task', exact: true }).locator('option:checked')).toHaveText('Collect sources')
  await expect(planner.getByLabel('Start', { exact: true })).toHaveValue('2026-10-01T09:00')
  await expect(planner.getByLabel('End', { exact: true })).toHaveValue('2026-10-01T10:00')
  await planner.getByRole('button', { name: 'Remove local block', exact: true }).click()
  await expect(planner.getByText('Local block removed. Its Google event remains unchanged.')).toBeVisible()
  await expect(planner.locator('.planner-day__timeline .planner-block')).toHaveCount(0)
})

for (const scenario of [
  { locale: 'de', dir: 'ltr', title: 'Wochenplaner', search: 'Aufgaben im Tresor suchen', review: 'Bidirektionalen Abgleich prüfen' },
  { locale: 'fa', dir: 'rtl', title: 'برنامه‌ریز هفتگی', search: 'جست‌وجوی وظایف مخزن', review: 'بازبینی همگام‌سازی دوسویه' },
] as const) {
  test(`localized ${scenario.locale} planner exposes keyboard-operable labels in the correct direction`, async ({ page }) => {
    await launchApp(page)
    await page.addInitScript(locale => localStorage.setItem('scriptor:locale', locale), scenario.locale)
    await page.reload()
    await openCommandPalette(page)
    await runCommand(page, 'Open tasks panel')
    const planner = page.getByRole('region', { name: scenario.title, exact: true })
    await expect(planner).toHaveAttribute('lang', scenario.locale)
    await expect(planner).toHaveAttribute('dir', scenario.dir)
    const search = planner.getByRole('searchbox', { name: scenario.search })
    await search.focus()
    await expect(search).toBeFocused()
    await search.fill('Collect')
    await expect(planner.getByRole('combobox', { name: scenario.locale === 'fa' ? 'وظیفهٔ مخزن' : 'Tresoraufgabe' })).toContainText('Collect sources')
    await expect(planner.getByRole('button', { name: scenario.review })).toBeVisible()
    await page.setViewportSize({ width: 375, height: 800 })
    const overflow = await planner.evaluate(element => element.scrollWidth - element.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}
