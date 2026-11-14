import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('VIS-003: the last of 500 assets and both actions remain reachable above mobile navigation', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:asset-media', '1')
    sessionStorage.setItem('e2e:asset-media-many', '1')
  })
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Asset deck')
  const panel = page.locator('.asset-deck-workspace[role="region"]')
  await expect(panel).toBeVisible()
  const rows = panel.locator('.research-asset-list > li')
  await expect(rows).toHaveCount(500)
  const search = panel.getByRole('searchbox', { name: 'Find a file', exact: true })
  const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation', exact: true })

  for (const direction of ['ltr', 'rtl']) for (const width of [320, 375]) for (const zoom of [1, 2]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.locator('html').evaluate((element, state) => {
      element.dir = state.direction
      element.style.zoom = String(state.zoom)
      element.style.setProperty('--app-viewport-width', `calc(100vw / ${state.zoom})`)
      element.style.setProperty('--app-viewport-height', `calc(100dvh / ${state.zoom})`)
      document.body.style.setProperty('--app-viewport-width', `calc(100vw / ${state.zoom})`)
      document.body.style.setProperty('--app-viewport-height', `calc(100dvh / ${state.zoom})`)
    }, { direction, zoom })
    await expect(nav).toBeVisible()
    const last = rows.last()
    await expect(last).toContainText('item-499-long-research-filename.png')
    for (const action of ['Open source', 'Create linked note']) {
      const button = last.getByRole('button', { name: action, exact: true })
      await button.scrollIntoViewIfNeeded()
      const geometry = await button.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const nav = document.querySelector<HTMLElement>('.mobile-workspace-nav')
        const navRect = nav?.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          navTop: navRect?.top ?? window.innerHeight,
          interactable: hit === element || (hit !== null && element.contains(hit)),
        }
      })
      expect(geometry.top, `${direction} ${width}px zoom ${zoom}: ${action} above top edge`).toBeGreaterThanOrEqual(0)
      expect(geometry.bottom, `${direction} ${width}px zoom ${zoom}: ${action} above bottom navigation`).toBeLessThanOrEqual(geometry.navTop - 4)
      expect(geometry.left).toBeGreaterThanOrEqual(-1)
      expect(geometry.right).toBeLessThanOrEqual(width + 1)
      expect(geometry.interactable, `${action} must not be covered by another surface`).toBe(true)
    }
    await search.scrollIntoViewIfNeeded()
    await expect(search).toBeInViewport()
    await search.fill('item-499')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('item-499-long-research-filename.png')
    await search.fill('no-such-asset')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('No files match')
    await search.fill('')
    await expect(rows).toHaveCount(500)
    if (width === 320 && zoom === 2) {
      await panel.screenshot({ path: testInfo.outputPath(`asset-500-${direction}-320-zoom2.png`) })
    }
  }
})
