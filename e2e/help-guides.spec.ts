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

test('F1 opens contextual help over a live graph without adding inline Help chrome', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const graph = page.getByRole('dialog', { name: 'Knowledge graph', exact: true })
  await expect(graph).toBeVisible()
  await expect(graph.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)

  const graphSurface = graph.locator('.graph-canvas.force, canvas[role="application"]').first()
  await expect(graphSurface).toBeVisible()
  await graphSurface.focus()
  await page.keyboard.press('F1')
  await expect(help(page).getByRole('heading', { name: 'Knowledge graph navigation', exact: true })).toBeVisible()
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab')
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.help-center')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(help(page)).toBeHidden()
  await expect(graph).toBeVisible()
  await expect(graphSurface).toBeFocused()
})

test('Help remains centralized after feature reopen', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const graph = page.getByRole('dialog', { name: 'Knowledge graph', exact: true })
  await expect(graph).toBeVisible()
  await expect(graph.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
  await expect(graph.getByRole('button', { name: /New here\? Guide|Help for/ })).toHaveCount(0)

  const graphSurface = graph.locator('.graph-canvas.force, canvas[role="application"]').first()
  await graphSurface.focus()
  await page.keyboard.press('F1')
  await expect(help(page).getByRole('heading', { name: 'Knowledge graph navigation', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help(page)).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(graph).toBeHidden()

  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  await expect(graph).toBeVisible()
  await expect(graph.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
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

for (const [command, title, selector] of [
  ['Open MCP panel', 'MCP automation modes and tools', '.mcp-panel'],
  ['Open canvas', 'Canvas board and spatial notes', '.canvas-overlay'],
  ['Open knowledge workbench', 'Knowledge Workbench', '.knowledge-workbench-panel'],
  ['Open tasks panel', 'Markdown-backed tasks', '.task-panel'],
] as const) {
  test(`contextual F1 guide for ${command} without inline Help chrome`, async ({ page }) => {
    await launchApp(page)
    await openCommandPalette(page)
    await runCommand(page, command)
    const owner = page.locator(selector).first()
    await expect(owner).toBeVisible()
    await expect(owner.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
    const focusTarget = owner.locator('button:not([aria-label^="Close"]), [role="tab"], select, input, [tabindex]').first()
    await expect(focusTarget).toBeVisible()
    await focusTarget.focus()
    await page.keyboard.press('F1')
    await expect(help(page).getByRole('heading', { name: title, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(help(page)).toBeHidden()
    await expect(owner).toBeVisible()
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
