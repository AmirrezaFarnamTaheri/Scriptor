import { expect, test, type Locator, type Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => document.documentElement.clientWidth)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(width)
}

async function expectDarkSurface(locator: Locator) {
  await expect(locator).toBeVisible()
  const background = await locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgb(255, 255, 255)')
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
}

async function closeSurface(surface: Locator) {
  const close = surface.getByRole('button', { name: /close/i }).first()
  await expect(close).toBeVisible()
  await close.click()
  await expect(surface).toBeHidden()
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
    await expectNoHorizontalOverflow(page)
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
    await expectNoHorizontalOverflow(page)
  })

  test('125% app zoom reflows without horizontal document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:ui-zoom', '1.25')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('data-ui-reflow', 'stacked')
    await expectNoHorizontalOverflow(page)
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(editor).not.toBeNull()
    expect(editor?.width ?? 0).toBeGreaterThan(240)
  })

  test('dark theme covers the reviewed settings, automation, knowledge, history, canvas, plugin, and publish surfaces', async ({ page }) => {
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
    await closeSurface(settings)

    await openCommandPalette(page)
    await runCommand(page, 'Open MCP panel')
    const mcp = page.getByRole('dialog', { name: 'MCP automation' })
    await expectDarkSurface(mcp)
    await closeSurface(mcp)

    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const graph = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expectDarkSurface(graph)
    await closeSurface(graph)

    await openCommandPalette(page)
    await runCommand(page, 'Open knowledge workbench')
    const workbench = page.getByRole('dialog', { name: 'Knowledge workbench' })
    await expectDarkSurface(workbench)
    await closeSurface(workbench)

    await openCommandPalette(page)
    await runCommand(page, 'Note history timeline')
    const history = page.getByRole('dialog', { name: 'Note history' })
    await expectDarkSurface(history)
    await closeSurface(history)

    await openCommandPalette(page)
    await runCommand(page, 'Open canvas')
    const canvas = page.getByRole('dialog', { name: 'Canvas board' })
    await expectDarkSurface(canvas)
    await closeSurface(canvas)

    await page.getByRole('tab', { name: 'Plugins', exact: true }).click()
    await expect(page.locator('.store-root')).toBeVisible()
    await expectDarkSurface(page.locator('.inspector-panel'))

    await page.locator('.workspace-mode-strip').getByRole('button', { name: 'Publish', exact: true }).click()
    const publish = page.getByRole('dialog', { name: /Export & publish|Publish center/ })
    await expectDarkSurface(publish)
    await expectNoHorizontalOverflow(page)
  })

  test('dark conflict resolver stays themed and requires an explicit resolution', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:app-theme', 'dark')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.sessionStorage.setItem('e2e:git-conflicts', '1')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    await openCommandPalette(page)
    await runCommand(page, 'Open Git panel')
    const git = page.getByRole('dialog', { name: 'Git', exact: true })
    await expectDarkSurface(git)
    await git.getByRole('button', { name: 'Resolve' }).click()

    const resolver = page.getByRole('dialog', { name: 'Resolve merge conflicts' })
    await expectDarkSurface(resolver)
    await expect(resolver.getByRole('button', { name: 'Apply resolved file' })).toBeDisabled()
    await resolver.getByRole('radio', { name: 'Keep theirs', exact: true }).check()
    await expect(resolver.getByRole('button', { name: 'Apply resolved file' })).toBeEnabled()
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

    await expectNoHorizontalOverflow(page)
    const editor = await page.locator('.editor-panel').boundingBox()
    expect(editor).not.toBeNull()
    expect(editor?.width ?? 0).toBeGreaterThan(260)
  })
})