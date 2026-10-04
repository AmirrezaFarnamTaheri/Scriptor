import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

for (const scenario of [
  { width: 1440, zoom: 1, presentation: 'modal', direction: 'ltr' },
  { width: 375, zoom: 1, presentation: 'modal', direction: 'rtl' },
  { width: 1440, zoom: 1, presentation: 'dock-right', direction: 'ltr' },
  { width: 1440, zoom: 2, presentation: 'modal', direction: 'ltr' },
] as const) {
  test(`history comparison owns useful space at ${scenario.width}px, ${scenario.zoom * 100}% and ${scenario.presentation}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 })
    await page.addInitScript(values => {
      localStorage.setItem('scriptor:panel-presentation', values.presentation)
      localStorage.setItem('scriptor:ui-zoom', String(values.zoom))
    }, scenario)
    await launchApp(page)
    await page.locator('html').evaluate((element, direction) => { element.dir = direction }, scenario.direction)
    await openCommandPalette(page)
    await runCommand(page, 'Note history timeline')
    const panel = page.locator('.note-history-panel')
    await expect(panel.locator('.note-history-revision-markdown')).toContainText('Previous revision')
    const geometry = await panel.evaluate(element => {
      const grid = element.querySelector<HTMLElement>('.note-history-layout')!
      const activity = element.querySelector('.note-history-activity')!.getBoundingClientRect()
      const timeline = element.querySelector('.note-history-timeline')!.getBoundingClientRect()
      const preview = element.querySelector('.note-history-preview-pane')!.getBoundingClientRect()
      const vocabulary = element.querySelector('.note-history-vocabulary')!.getBoundingClientRect()
      const bounds = grid.getBoundingClientRect()
      const header = element.querySelector('.note-history-preview-header')!
      const children = [...header.children].map(child => child.getBoundingClientRect())
      const scale = bounds.width / grid.offsetWidth
      return {
        gridWidth: grid.clientWidth, previewWidth: preview.width, activityWidth: activity.width,
        timelineLeft: timeline.left, previewLeft: preview.left, previewTop: preview.top,
        timelineBottom: timeline.bottom, activityBottom: activity.bottom,
        vocabularyLeft: vocabulary.left, vocabularyRight: vocabulary.right,
        gridLeft: bounds.left, gridRight: bounds.right,
        titleWidth: children[0].width / scale,
        dividerGap: (timeline.top - element.querySelector('.unified-panel-header')!.getBoundingClientRect().bottom) / scale,
        headerOverlaps: children.some((a, index) => children.slice(index + 1).some(b =>
          a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)),
        previewOverflow: element.querySelector<HTMLElement>('.note-history-preview-pane')!.scrollWidth
          - element.querySelector<HTMLElement>('.note-history-preview-pane')!.clientWidth,
      }
    })
    if (geometry.gridWidth > 720) {
      expect(geometry.previewWidth).toBeGreaterThan(geometry.activityWidth * 1.5)
      expect(Math.abs(geometry.previewLeft - geometry.timelineLeft)).toBeLessThanOrEqual(1)
    } else {
      expect(geometry.previewTop).toBeGreaterThanOrEqual(geometry.activityBottom - 1)
      expect(Math.abs(geometry.previewLeft - geometry.gridLeft)).toBeLessThanOrEqual(1)
    }
    expect(geometry.previewTop).toBeGreaterThanOrEqual(geometry.timelineBottom - 1)
    expect(Math.abs(geometry.vocabularyLeft - geometry.gridLeft)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.vocabularyRight - geometry.gridRight)).toBeLessThanOrEqual(1)
    expect(geometry.titleWidth).toBeGreaterThanOrEqual(175)
    expect(geometry.dividerGap).toBeGreaterThanOrEqual(12)
    expect(geometry.headerOverlaps).toBe(false)
    expect(geometry.previewOverflow).toBeLessThanOrEqual(1)
    await panel.screenshot({ path: testInfo.outputPath(`history-layout-${scenario.width}-${scenario.zoom}-${scenario.presentation}.png`), animations: 'disabled' })

    await panel.getByRole('button', { name: 'Restore revision', exact: true }).click()
    const confirmation = panel.getByRole('group', { name: 'Confirm revision restore' })
    await expect(confirmation).toBeVisible()
    const restore = confirmation.getByRole('button', { name: 'Restore revision', exact: true })
    await restore.scrollIntoViewIfNeeded()
    await expect(restore).toBeInViewport()
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
    const analyze = panel.getByRole('button', { name: 'Analyze vocabulary evolution', exact: true })
    await analyze.scrollIntoViewIfNeeded()
    await expect(analyze).toBeInViewport()
    const appearance = await analyze.evaluate(element => {
      const style = getComputedStyle(element)
      return {
        height: element.getBoundingClientRect().height / (element as HTMLElement).offsetHeight * Number.parseFloat(style.height),
        radius: Number.parseFloat(style.borderRadius),
        background: style.backgroundColor, color: style.color,
        font: style.fontFamily, bodyFont: getComputedStyle(document.body).fontFamily,
      }
    })
    expect(appearance.height).toBeGreaterThanOrEqual(44)
    expect(appearance.radius).toBeGreaterThan(0)
    expect(appearance.background).not.toBe(appearance.color)
    expect(appearance.font).toBe(appearance.bodyFont)
    await panel.locator('.note-history-vocabulary').getByText('Vocabulary comparison', { exact: true }).click()
    const table = panel.locator('.note-history-vocabulary table')
    await table.scrollIntoViewIfNeeded()
    await expect(table).toBeInViewport()
    await expect.poll(() => table.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  })
}
