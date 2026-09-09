import { expect, test, type Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
      })),
    )
    .toEqual({
      clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
      scrollWidth: await page.evaluate(() => document.documentElement.clientWidth),
      clientHeight: await page.evaluate(() => document.documentElement.clientHeight),
      scrollHeight: await page.evaluate(() => document.documentElement.clientHeight),
    })
}

async function expectDarkSurface(locator: ReturnType<Page['locator']>) {
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
    await expectDarkSurface(settings.locator('.settings-panel').first())
    await settings.getByRole('button', { name: /Close Settings/i }).click()

    await openCommandPalette(page)
    await runCommand(page, 'Open MCP panel')
    const mcp = page.getByRole('dialog', { name: 'MCP automation' })
    await expectDarkSurface(mcp.locator('.mcp-panel').first())
    await mcp.getByRole('button', { name: /Close MCP/i }).click()

    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const graph = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expectDarkSurface(graph.locator('.graph-panel').first())
    await graph.getByRole('button', { name: 'Close graph' }).click()

    await page.locator('.workspace-mode-strip').getByRole('button', { name: /Publish|Veröffentlichen|انتشار/ }).click()
    const publish = page.getByRole('dialog', { name: /Export and publish|Publish center/ })
    await expectDarkSurface(publish.locator('.publish-center').first())
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