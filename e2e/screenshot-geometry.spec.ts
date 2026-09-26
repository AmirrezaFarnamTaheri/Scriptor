import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout } from './helpers'

/** Normalizes sub-pixel layout measurements before comparing screenshot geometry. */
function rounded(value: number) {
  return Math.round(value)
}

test.describe('screenshot geometry contracts', () => {
  test('tablet rail labels and daily date fit without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await launchApp(page)
    await settleLayout(page)

    const tabs = page.locator('.inspector-tabs button')
    await expect(tabs).toHaveCount(3)
    await expect
      .poll(
        () => tabs.evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth + 1)),
        { timeout: 10_000, message: 'Inspector tab labels should fit after the rail settles' },
      )
      .toBe(true)

    const dateButton = page.locator('.daily-note-button')
    await expect(dateButton.locator('.daily-note-label-compact')).toBeVisible()
    await expect(dateButton.locator('.daily-note-label-full')).toBeHidden()
    const dateLayout = await dateButton.evaluate((button) => {
      const parent = button.parentElement
      const buttonRect = button.getBoundingClientRect()
      const parentRect = parent?.getBoundingClientRect()
      return {
        fitsTrack: Boolean(parentRect && buttonRect.right <= parentRect.right + 1),
        usesEllipsis: getComputedStyle(button).textOverflow === 'ellipsis',
      }
    })
    expect(dateLayout).toEqual({ fitsTrack: true, usesEllipsis: true })

    const history = await page.locator('.history-controls').boundingBox()
    const mode = await page.locator('.workspace-mode-strip').boundingBox()
    expect(history).not.toBeNull()
    expect(mode).not.toBeNull()
    expect((history?.x ?? 0) + (history?.width ?? 0)).toBeLessThanOrEqual((mode?.x ?? 0) + 1)
    await expect(page.locator('.workspace-mode-select')).toBeVisible()
  })

  test('editor toolbar keeps its persistent control groups on one row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await launchApp(page)
    await settleLayout(page)

    const toolbar = page.locator('.editor-toolbar')
    const geometry = await toolbar.evaluate((element) => {
      const groups = Array.from(element.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('format-group'),
      )
      const toolbarRect = element.getBoundingClientRect()
      return {
        toolbarHeight: toolbarRect.height,
        groups: groups.map((group) => {
          const rect = group.getBoundingClientRect()
          return { top: rect.top, left: rect.left, right: rect.right, width: rect.width }
        }),
      }
    })

    expect(geometry.groups).toHaveLength(3)
    const tops = geometry.groups.map((item) => rounded(item.top))
    expect(new Set(tops).size).toBe(1)
    expect(rounded(geometry.toolbarHeight)).toBeLessThanOrEqual(56)

    const editorRight = await page.locator('.editor-panel').evaluate((panel) => panel.getBoundingClientRect().right)
    for (const group of geometry.groups) {
      expect(group.right).toBeLessThanOrEqual(editorRight + 1)
      expect(group.width).toBeGreaterThan(0)
    }
  })

  test('inspector note health adapts its metric matrix to the rail width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await launchApp(page)
    await settleLayout(page)

    const inspector = page.locator('.inspector-panel')
    const metrics = inspector.locator('.metric-grid .metric')
    await expect(metrics).toHaveCount(8)
    const geometry = await metrics.evaluateAll((nodes) => {
      const panel = nodes[0]?.closest('.inspector-panel')
      const panelWidth = panel instanceof HTMLElement ? panel.getBoundingClientRect().width : 0
      return {
        panelWidth: Math.round(panelWidth),
        positions: nodes.map((node) => {
          const rect = node.getBoundingClientRect()
          return { top: Math.round(rect.top), left: Math.round(rect.left) }
        }),
      }
    })

    expect(geometry.panelWidth).toBeGreaterThan(0)
    const expectedColumns = geometry.panelWidth <= 450 ? 2 : 4
    const tops = geometry.positions.map(({ top }) => top)
    const lefts = geometry.positions.map(({ left }) => left)
    const rows = [...new Set(tops)]
    const columns = [...new Set(lefts)]

    expect(columns).toHaveLength(expectedColumns)
    expect(rows).toHaveLength(8 / expectedColumns)
    for (const row of rows) {
      expect(tops.filter((top) => top === row)).toHaveLength(expectedColumns)
    }
  })

  test('preview QA keeps labels and values separated at rail width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await launchApp(page)
    await page.locator('.inspector-tabs').getByRole('tab', { name: 'Rendered output', exact: true }).click()
    await settleLayout(page)

    const qa = page.locator('.preview-qa-bar')
    await expect(qa).toBeVisible()
    const rows = qa.locator(':scope > div')
    await expect(rows).toHaveCount(2)

    for (let index = 0; index < 2; index += 1) {
      const [labelBox, valueBox] = await Promise.all([
        rows.nth(index).locator('strong').boundingBox(),
        rows.nth(index).locator('span').boundingBox(),
      ])
      expect(labelBox).not.toBeNull()
      expect(valueBox).not.toBeNull()
      expect((labelBox?.x ?? 0) + (labelBox?.width ?? 0)).toBeLessThanOrEqual((valueBox?.x ?? 0) - 4)
    }

    const [qaBox, publishBox] = await Promise.all([
      qa.boundingBox(),
      qa.getByRole('button', { name: 'Publish center', exact: true }).boundingBox(),
    ])
    expect(qaBox).not.toBeNull()
    expect(publishBox).not.toBeNull()
    expect(publishBox?.width ?? 0).toBeGreaterThan((qaBox?.width ?? 0) * 0.75)
  })

  test('docked Git row keeps identity, status, and actions visible without redundant path copy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => window.localStorage.setItem('scriptor:panel-presentation', 'dock-right'))
    await launchApp(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open Git panel')

    const panel = page.getByRole('complementary', { name: 'Git', exact: true })
    await expect(panel).toBeVisible({ timeout: 45_000 })
    const row = panel.locator('.git-changes li').first()
    await expect(row).toBeVisible()
    await expect(row.locator('.git-file-path')).toBeHidden()
    await expect(row.locator('.git-file-row-actions button')).toHaveCount(2)

    const rowBox = await row.boundingBox()
    expect(rowBox).not.toBeNull()
    for (const button of await row.locator('.git-file-row-actions button').all()) {
      const box = await button.boundingBox()
      expect(box).not.toBeNull()
      expect(box?.x ?? 0).toBeGreaterThanOrEqual((rowBox?.x ?? 0) - 1)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((rowBox?.x ?? 0) + (rowBox?.width ?? 0) + 1)
      expect(box?.y ?? 0).toBeGreaterThanOrEqual((rowBox?.y ?? 0) - 1)
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((rowBox?.y ?? 0) + (rowBox?.height ?? 0) + 1)
    }
  })
})
