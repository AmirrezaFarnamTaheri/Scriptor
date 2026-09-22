import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

for (const width of [1024, 1440]) {
  test(`Help stays centralized and product chrome stays clean at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await launchApp(page)
    await waitForWorkspace(page)

    await expect(page.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)
    await expect(page.locator('header.topbar').getByRole('button', { name: 'Help & guides', exact: true })).toBeVisible()

    const toolbar = page.locator('.format-row.editor-toolbar')
    await expect(toolbar).toHaveCSS('flex-wrap', 'nowrap')
  })
}

test('F1 opens the focused feature guide without injecting feature-level Help controls', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open MCP panel')

  const mcp = page.getByRole('dialog', { name: 'MCP automation', exact: true })
  await expect(mcp).toBeVisible()
  await expect(mcp.locator('.help-affordance, .help-trigger, .help-invitation')).toHaveCount(0)

  const auditTab = mcp.getByRole('tab', { name: 'Audit', exact: true })
  await auditTab.focus()
  await page.keyboard.press('F1')

  const help = page.getByRole('dialog', { name: 'Help & guides', exact: true })
  await expect(help).toBeVisible()
  await expect(help.getByRole('heading', { name: 'MCP automation modes and tools', exact: true })).toBeVisible()
})

test('workspace tour can reveal a region from the single global Help entry', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Help & guides', exact: true }).click()
  const help = page.getByRole('dialog', { name: 'Help & guides', exact: true })
  await help.getByRole('button', { name: 'Start tour', exact: true }).click()
  await help.getByRole('button', { name: 'Show this control', exact: true }).click()
  await expect(help).toBeHidden()
  await expect(page.locator('.vault-panel')).toHaveAttribute('data-help-highlight', 'true')
  await expect(page.locator('.vault-panel')).toBeFocused()
})
