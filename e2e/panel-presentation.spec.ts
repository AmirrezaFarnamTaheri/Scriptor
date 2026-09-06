import { expect, test, type Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

const OPEN_GIT = 'Open Git panel'
const OPEN_MCP = 'Open MCP panel'

async function useDockedPanels(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('scriptor:panel-presentation', 'dock-right')
    window.localStorage.setItem('scriptor:onboarding-complete', 'true')
  })
}

async function runGitCommand(page: Page) {
  await openCommandPalette(page)
  await runCommand(page, OPEN_GIT)
}

async function openWideGitDock(page: Page) {
  await runGitCommand(page)
  const panel = page.getByRole('complementary', { name: 'Git', exact: true })
  await expect(panel).toBeVisible({ timeout: 45_000 })
  await settleLayout(page)
  return panel
}

test.describe('adaptive panel presentation', () => {
  test('wide desktop uses a bounded companion rail without crushing the editor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await useDockedPanels(page)
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const editor = page.locator('.editor-panel')
    const inspector = page.locator('.inspector-panel')
    const before = await editor.boundingBox()
    expect(before).not.toBeNull()
    await expect(inspector).toBeVisible()

    const dock = await openWideGitDock(page)
    const [after, dockBox, footerBox] = await Promise.all([
      editor.boundingBox(),
      dock.boundingBox(),
      page.locator('.status-summary').boundingBox(),
    ])

    expect(after).not.toBeNull()
    expect(dockBox).not.toBeNull()
    expect(footerBox).not.toBeNull()
    await expect(inspector).toBeHidden()
    expect(after!.width).toBeGreaterThan(before!.width - 120)
    expect(dockBox!.width).toBeGreaterThanOrEqual(360)
    expect(dockBox!.width).toBeLessThanOrEqual(442)
    expect(after!.x + after!.width).toBeLessThanOrEqual(dockBox!.x + 2)
    expect(footerBox!.x + footerBox!.width).toBeLessThanOrEqual(dockBox!.x + 2)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440)
  })

  test('compact desktop converts a dock preference into a modal without changing workspace geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await useDockedPanels(page)
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const editor = page.locator('.editor-panel')
    const before = await editor.boundingBox()
    expect(before).not.toBeNull()

    await runGitCommand(page)
    const dialog = page.getByRole('dialog', { name: 'Git', exact: true })
    await expect(dialog).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('complementary', { name: 'Git', exact: true })).toHaveCount(0)
    await expect(page.locator('.inspector-panel')).toBeVisible()
    await settleLayout(page)

    const after = await editor.boundingBox()
    expect(after).not.toBeNull()
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(3)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024)
  })

  test('app zoom reflow also converts a physically wide viewport to modal presentation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await useDockedPanels(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('scriptor:ui-zoom', '1.25')
    })
    await launchApp(page)
    await waitForWorkspace(page)
    await expect.poll(() => page.locator('html').getAttribute('data-ui-reflow')).toBe('stacked')

    await runGitCommand(page)
    await expect(page.getByRole('dialog', { name: 'Git', exact: true })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('complementary', { name: 'Git', exact: true })).toHaveCount(0)
  })

  test('opening another companion replaces the existing dock and legacy feature CSS cannot retake the shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await useDockedPanels(page)
    await launchApp(page)
    await waitForWorkspace(page)
    await openWideGitDock(page)

    await openCommandPalette(page)
    await runCommand(page, OPEN_MCP)

    await expect(page.locator('.git-panel')).toHaveCount(0)
    const mcp = page.locator('.mcp-panel.unified-panel-docked')
    await expect(mcp).toBeVisible({ timeout: 45_000 })

    const shellStyle = await mcp.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        display: style.display,
        flexDirection: style.flexDirection,
        paddingTop: style.paddingTop,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
      }
    })
    expect(shellStyle).toEqual({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: '0px',
      overflowX: 'hidden',
      overflowY: 'hidden',
    })

    const [mcpBox, actionsBox] = await Promise.all([
      mcp.boundingBox(),
      mcp.locator('.unified-panel-header-actions').boundingBox(),
    ])
    expect(mcpBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect(actionsBox!.x).toBeGreaterThanOrEqual(mcpBox!.x - 1)
    expect(actionsBox!.x + actionsBox!.width).toBeLessThanOrEqual(mcpBox!.x + mcpBox!.width + 1)
  })
})
