import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

for (const width of [1024, 1440]) {
  test(`contextual help joins the existing toolbar row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await launchApp(page)
    await waitForWorkspace(page)
    const toolbar = page.locator('.format-row.editor-toolbar')
    const trigger = toolbar.getByRole('button', { name: 'Help for Formatting, Typography, Insert, and Tools', exact: true })
    await expect(trigger).toBeVisible()
    await expect.poll(() => trigger.evaluate((button) => Boolean(button.closest('.inline-editor-assist, .toolbar-pinned')))).toBe(true)
    const spread = await toolbar.evaluate((element) => {
      const visible = [...element.children].filter((child) => {
        const rect = child.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      const centers = visible.map((child) => { const rect = child.getBoundingClientRect(); return (rect.top + rect.bottom) / 2 })
      return centers.length ? Math.max(...centers) - Math.min(...centers) : 0
    })
    expect(spread).toBeLessThanOrEqual(1)
    await expect(toolbar).toHaveCSS('flex-wrap', 'nowrap')
  })
}

test('a first-use invitation yields when another feature opens', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const graph = page.getByRole('dialog', { name: 'Knowledge graph', exact: true })
  await expect(graph.getByRole('button', { name: 'New here? Guide', exact: true })).toBeVisible()
  await openCommandPalette(page)
  await runCommand(page, 'Open MCP panel')
  const mcp = page.getByRole('dialog', { name: 'MCP automation', exact: true })
  await expect(mcp.getByRole('button', { name: 'New here? Guide', exact: true })).toBeVisible()
  await expect(page.locator('.help-invitation')).toHaveCount(1)
  await expect(page.locator('.help-center[open]')).toHaveCount(0)
  await mcp.getByRole('button', { name: 'Dismiss this guide invitation', exact: true }).click()
  await page.keyboard.press('Escape')
  await openCommandPalette(page)
  await runCommand(page, 'Open MCP panel')
  await expect(mcp.getByRole('button', { name: 'Help for MCP automation modes and tools', exact: true })).toBeVisible()
  await expect(mcp.locator('.help-invitation')).toHaveCount(0)
})

test('workspace tour can reveal a region outside its top-bar help host', async ({ page }) => {
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
