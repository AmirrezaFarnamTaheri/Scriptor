import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

const help = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Help & guides', exact: true })

test('Help is searchable from commands and does not require a provider', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Help & guides')
  const dialog = help(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Offline product guidance.', { exact: false })).toBeVisible()
  await dialog.getByRole('searchbox', { name: 'Search guides and questions' }).fill('keychain')
  await expect(dialog.getByRole('button', { name: 'Connect Google Calendar and Tasks', exact: true }).first()).toBeVisible()
  await dialog.getByRole('button', { name: 'Connect Google Calendar and Tasks', exact: true }).first().click()
  await dialog.getByRole('button', { name: 'Questions & answers', exact: true }).click()
  await expect(dialog.getByText('Why does login fail before browser consent?')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('F1 opens contextual help over a live graph without closing the graph', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const graph = page.getByRole('dialog', { name: 'Knowledge graph', exact: true })
  await expect(graph).toBeVisible()
  const trigger = graph.getByRole('button', { name: 'Help for Knowledge graph navigation', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.focus()
  await page.keyboard.press('F1')
  await expect(help(page).getByRole('heading', { name: 'Knowledge graph navigation', exact: true })).toBeVisible()
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.help-center')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(help(page)).toBeHidden()
  await expect(graph).toBeVisible()
  await expect(trigger).toBeFocused()
})

test('first-use invitations do not start tours and dismissal survives reopen', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const graph = page.getByRole('dialog', { name: 'Knowledge graph', exact: true })
  await expect(graph.getByRole('button', { name: 'New here? Guide', exact: true })).toBeVisible()
  await expect(help(page)).toBeHidden()
  await graph.getByRole('button', { name: 'Dismiss this guide invitation', exact: true }).click()
  await page.keyboard.press('Escape')
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  await expect(graph.getByRole('button', { name: 'New here? Guide', exact: true })).toHaveCount(0)
  await expect(graph.getByRole('button', { name: 'Help for Knowledge graph navigation', exact: true })).toBeVisible()
})

test('tour progress resumes, missing targets are honest, and reset preserves other storage', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => localStorage.setItem('help-test-unrelated', 'keep'))
  await page.locator('header.topbar').getByRole('button', { name: 'Help & guides', exact: true }).click()
  const dialog = help(page)
  await dialog.getByRole('searchbox', { name: 'Search guides and questions' }).fill('restore verified backup')
  await dialog.getByRole('button', { name: 'Restore a verified backup', exact: true }).first().click()
  await dialog.getByRole('button', { name: 'Start tour', exact: true }).click()
  await dialog.getByRole('button', { name: 'Show this control', exact: true }).click()
  await expect(dialog.getByText('This control is not currently visible.', { exact: false })).toBeVisible()
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.reload()
  await waitForWorkspace(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Help & guides', exact: true }).click()
  await dialog.getByRole('searchbox', { name: 'Search guides and questions' }).fill('restore verified backup')
  await dialog.getByRole('button', { name: 'Restore a verified backup', exact: true }).first().click()
  await dialog.getByRole('button', { name: 'Resume tour', exact: true }).click()
  await expect(dialog.getByText('Step 2 of 4', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Reset guide progress', exact: true }).click()
  await dialog.getByRole('button', { name: 'Reset help only', exact: true }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('help-test-unrelated'))).toBe('keep')
  await expect(dialog.getByText('Step 1 of 4', { exact: true })).toBeVisible()
})

for (const [command, title] of [
  ['Open MCP panel', 'MCP automation modes and tools'],
  ['Open canvas', 'Canvas board and spatial notes'],
  ['Open knowledge workbench', 'Knowledge Workbench'],
  ['Open tasks panel', 'Markdown-backed tasks'],
] as const) {
  test(`contextual guide for ${command}`, async ({ page }) => {
    await launchApp(page)
    await openCommandPalette(page)
    await runCommand(page, command)
    const trigger = page.getByRole('button', { name: `Help for ${title}`, exact: true }).first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    await expect(help(page).getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeVisible()
  })
}

test('Help stays readable at 375px and explicitly marks English guide content in Persian UI', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript(() => localStorage.setItem('scriptor:locale', 'fa'))
  await launchApp(page)
  await page.keyboard.press('F1')
  const dialog = page.locator('dialog.help-center')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('dir', 'rtl')
  await expect(dialog.locator('.help-language-notice')).toBeVisible()
  await expect(dialog.locator('.help-topic-heading')).toHaveAttribute('lang', 'en')
  await expect.poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
