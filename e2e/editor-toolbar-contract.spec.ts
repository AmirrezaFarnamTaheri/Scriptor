import { expect, test, type Page } from '@playwright/test'

import { settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

async function openWorkspace(page: Page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height })
  await page.addInitScript((chromePrefs) => {
    window.localStorage.setItem('scriptor:app-theme', 'light')
    window.localStorage.setItem('scriptor:onboarding-complete', 'true')
    window.localStorage.setItem('scriptor:editor-mode', 'monaco')
    window.localStorage.setItem('scriptor:headless-engine', 'false')
    window.localStorage.setItem('scriptor:workspace-mode', 'writing')
    window.localStorage.setItem('scriptor:mobile-pane', 'editor')
    window.localStorage.setItem('scriptor:inspector-preset', 'balanced')
    window.localStorage.setItem('scriptor:split-preview', 'false')
    window.localStorage.setItem('scriptor:status-dock-collapsed', 'true')
    window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
  }, WORKSPACE_CHROME_PREFS)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForWorkspace(page)
  await settleLayout(page)
}

async function expectSingleToolbarRow(page: Page, requireHorizontalOverflow = false) {
  const toolbar = page.locator('.format-row.editor-toolbar')
  await expect(toolbar).toBeVisible()
  await expect(toolbar).toHaveCSS('flex-wrap', 'nowrap')
  await expect(toolbar).toHaveCSS('overflow-y', 'hidden')

  const geometry = await toolbar.evaluate((element) => {
    const toolbarRect = element.getBoundingClientRect()
    const children = [...element.children].filter((child) => {
      const rect = child.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    const tops = children.map((child) => Math.round(child.getBoundingClientRect().top))
    return {
      toolbarHeight: Math.round(toolbarRect.height),
      distinctRows: new Set(tops).size,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }
  })

  expect(geometry.distinctRows).toBe(1)
  expect(geometry.toolbarHeight).toBeLessThanOrEqual(56)
  if (requireHorizontalOverflow) expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth)
  else expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth)
}

test.describe('editor toolbar geometry contract', () => {
  test('keeps one persistent command row on the standard workspace', async ({ page }) => {
    await openWorkspace(page)
    await expectSingleToolbarRow(page)
  })

  test('keeps one persistent command row at the 1024px workspace breakpoint', async ({ page }) => {
    await openWorkspace(page, 1024, 768)
    await expectSingleToolbarRow(page, true)
  })
})
