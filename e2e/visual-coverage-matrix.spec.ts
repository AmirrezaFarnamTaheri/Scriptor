import { expect, test, type Locator, type Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.clientWidth)
  const height = await page.evaluate(() => document.documentElement.clientHeight)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
      })),
    )
    .toEqual({ scrollWidth: width, scrollHeight: height })
}

async function expectDarkSurface(locator: Locator) {
  await expect(locator).toBeVisible()
  const background = await locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgb(255, 255, 255)')
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
}

test.describe('visual coverage matrix', () => {
  test('Persian RTL workspace preserves viewport geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'fa')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.getByRole('main', { name: 'Scriptor workspace' })).toBeVisible()
    await expectNoDocumentOverflow(page)
  })

  test('German expansion keeps the primary editor toolbar on one row at compact desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'de')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    const toolbar = page.locator('.editor-toolbar')
    await expect(toolbar).toBeVisible()
    const rowTops = await toolbar.locator(':scope > .format-group').evaluateAll((groups) =>
      groups.map((group) => Math.round(group.getBoundingClientRect().top)),
    )
    expect(new Set(rowTops).size).toBe(1)
    await expectNoDocumentOverflow(page)
  })

  test('dark theme covers Settings, MCP, graph, and export/publish surfaces', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expectDarkSurface(settings)
    await settings.getByRole('button', { name: /Close Settings/i }).click()

    await openCommandPalette(page)
    await runCommand(page, 'Open MCP panel')
    const mcp = page.getByRole('dialog', { name: 'MCP automation' })
    await expectDarkSurface(mcp)
    await mcp.getByRole('button', { name: /Close MCP/i }).click()

    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const graph = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expectDarkSurface(graph)
    await graph.getByRole('button', { name: 'Close graph' }).click()

    await page.locator('.workspace-mode-strip').getByRole('button', { name: 'Publish', exact: true }).click()
    const publish = page.getByRole('dialog', { name: /Export and publish|Publish center/ })
    await expectDarkSurface(publish)
    await expectNoDocumentOverflow(page)
  })

  test('long localized workspace chrome never produces page-level horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:locale', 'de')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:status-dock-collapsed', 'false')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expectNoDocumentOverflow(page)
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(editor).not.toBeNull()
    expect(editor?.width ?? 0).toBeGreaterThan(260)
  })
})