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

async function openGit(page: Page) {
  await openCommandPalette(page)
  await runCommand(page, OPEN_GIT)
  const panel = page.getByRole('complementary', { name: 'Git', exact: true })
  await expect(panel).toBeVisible({ timeout: 45_000 })
  await settleLayout(page)
  return panel
}

test.describe('adaptive panel presentation', () => {
  test('wide desktop uses a bounded real dock that reserves workspace and footer width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await useDockedPanels(page)
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const editor = page.locator('.editor-panel')
    const before = await editor.boundingBox()
    expect(before).not.toBeNull()

    const dock = await openGit(page)
    const [after, dockBox, inspectorBox, footerBox] = await Promise.all([
      editor.boundingBox(),
      dock.boundingBox(),
      page.locator('.inspector-panel').boundingBox(),
      page.locator('.status-summary').boundingBox(),
    ])

    expect(after).not.toBeNull()
    expect(dockBox).not.toBeNull()
    expect(inspectorBox).not.toBeNull()
    expect(footerBox).not.toBeNull()
    expect(after!.width).toBeLessThan(before!.width - 80)
    expect(dockBox!.width).toBeGreaterThanOrEqual(360)
    expect(dockBox!.width).toBeLessThanOrEqual(442)
    expect(inspectorBox!.x + inspectorBox!.width).toBeLessThanOrEqual(dockBox!.x + 2)
    expect(footerBox!.x + footerBox!.width).toBeLessThanOrEqual(dockBox!.x + 2)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440)
  })

  test('compact desktop keeps dock presentation as an overlay without crushing the editor', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await useDockedPanels(page)
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const editor = page.locator('.editor-panel')
    const before = await editor.boundingBox()
    expect(before).not.toBeNull()

    const dock = await openGit(page)
    const [after, dockBox] = await Promise.all([editor.boundingBox(), dock.boundingBox()])
    expect(after).not.toBeNull()
    expect(dockBox).not.toBeNull()
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(3)
    expect(dockBox!.width).toBeLessThanOrEqual(522)
    expect(dockBox!.x).toBeLessThan(after!.x + after!.width)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024)
  })

  test('opening another companion replaces the existing dock and legacy feature CSS cannot retake the shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await useDockedPanels(page)
    await launchApp(page)
    await waitForWorkspace(page)
    await openGit(page)

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
  })
})
