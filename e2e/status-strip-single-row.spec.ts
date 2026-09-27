import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

/**
 * The status strip must stay one line in every state that shows the pills, and the
 * vault name must never drop below them. Both used to happen whenever the row was
 * tight — the responsive band and, independently, any docked companion panel —
 * which silently grew the bottom dock by two lines.
 *
 * "One line" cannot be counted as distinct `top` values: the children are
 * differently sized and baseline-aligned, so a single row already reports tops a few
 * pixels apart. Rows are bucketed with a tolerance instead, and the strip's own
 * height bounds it independently.
 */
const ROW_TOLERANCE = 12
const MAX_SINGLE_ROW_HEIGHT = 72

async function expandDock(page: Page) {
  const toggle = page.locator('.dock-chrome-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
  }
  await expect(page.locator('.repo-state')).toBeVisible({ timeout: 10_000 })
}

async function measure(page: Page) {
  return page.evaluate((tolerance) => {
    const strips = Array.from(document.querySelectorAll('.status-strip')) as HTMLElement[]
    const strip = strips.find((s) => s.getBoundingClientRect().height > 0)
    if (!strip) return null
    const summary = Array.from(strip.querySelectorAll('.status-summary > *')).filter(
      (n) => n.getBoundingClientRect().height > 0,
    )
    const repo = strip.querySelector('.repo-state') as HTMLElement | null
    const repoVisible = Boolean(repo && repo.getBoundingClientRect().width > 0)
    // `display: none` children report a zero rect, which would otherwise be counted
    // as its own row at top 0.
    const repoKids = repoVisible
      ? Array.from(repo.children).filter((n) => n.getBoundingClientRect().height > 0)
      : []

    const rows = (nodes: Element[]) => {
      const tops = nodes.map((n) => n.getBoundingClientRect().top).sort((a, b) => a - b)
      let count = 0
      let last = Number.NEGATIVE_INFINITY
      for (const top of tops) {
        if (top - last > tolerance) count += 1
        last = top
      }
      return count
    }

    const vault = strip.querySelector('.repo-vault') as HTMLElement | null
    const vaultVisible = Boolean(vault && vault.getBoundingClientRect().width > 0)
    const summaryTop = summary.length ? summary[0].getBoundingClientRect().top : 0

    return {
      // The summary row, not the whole strip: expanding the dock opens its panel
      // inside the strip, so the strip's height legitimately grows.
      summaryHeight: Math.round(
        (strip.querySelector('.status-summary') as HTMLElement).getBoundingClientRect().height,
      ),
      summaryRows: rows(summary),
      repoRows: repoVisible ? rows(repoKids) : 0,
      repoVisible,
      vaultVisible,
      vaultOnOwnLine: vaultVisible
        && vault!.getBoundingClientRect().top > summaryTop + 2,
    }
  }, ROW_TOLERANCE)
}

async function expectOneRow(page: Page, label: string) {
  for (const width of [1440, 1320, 1200, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(400)
    const m = await measure(page)
    // Evidence: the geometry each width band actually produced.
    console.log(`${label} w${width} ${JSON.stringify(m)}`)
    expect(m, `no status strip at ${width}px`).not.toBeNull()
    expect(m!.summaryRows, `${label}: summary wrapped at ${width}px`).toBe(1)
    expect(m!.summaryHeight, `${label}: summary grew past one row at ${width}px`).toBeLessThanOrEqual(
      MAX_SINGLE_ROW_HEIGHT,
    )
    expect(m!.repoRows, `${label}: repo-state wrapped at ${width}px`).toBeLessThanOrEqual(1)
    expect(m!.vaultOnOwnLine, `${label}: vault name dropped to its own line at ${width}px`).toBe(false)
  }
}

test('status strip stays one row with the vault open', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.virtual-note-list').getByRole('button', { name: 'Research Plan.md' }).click()
  await expect(page.locator('.view-line').first()).toBeVisible({ timeout: 20_000 })
  await expandDock(page)
  await expectOneRow(page, 'PLAIN')
})

test('status strip stays one row with a companion panel docked', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await expandDock(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open MCP panel')
  await expect(page.locator('.mcp-panel')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1200)
  await expectOneRow(page, 'DOCKED')
})
