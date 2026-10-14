import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

test.describe('Workspace dock, tab and live-preview regressions', () => {
  test('keeps the application fixed while the entire vault dock scrolls independently', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await launchApp(page)
    await waitForWorkspace(page)
    await page.setViewportSize({ width: 1024, height: 460 })

    const dockScroll = page.locator('.vault-sidebar-scroll')
    await expect(dockScroll).toBeVisible()
    await expect.poll(() => dockScroll.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(16)
    await dockScroll.evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect.poll(() => dockScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(16)

    const metrics = await page.evaluate(() => {
      const footer = document.querySelector('.vault-sidebar-footer')!.getBoundingClientRect()
      const dock = document.querySelector('.vault-panel')!.getBoundingClientRect()
      const viewport = document.documentElement.clientHeight
      return {
        pageOverflow: document.scrollingElement!.scrollHeight - viewport,
        scrollY: window.scrollY,
        footerBottom: footer.bottom,
        dockBottom: dock.bottom,
        viewport,
      }
    })
    expect(metrics.pageOverflow).toBeLessThanOrEqual(1)
    expect(metrics.scrollY).toBe(0)
    expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.dockBottom + 1)
    expect(metrics.dockBottom).toBeLessThanOrEqual(metrics.viewport + 1)
  })

  test('uses one note tab row when the primary workspace only contains note leaves', async ({ page }) => {
    await launchApp(page)
    await waitForWorkspace(page)
    await expect(page.locator('.editor-panel[data-help-topic="editor"] .tabs-row')).toBeVisible()
    await expect(page.locator('.workspace-group-heading.primary .workspace-leaf-bar')).toHaveCount(0)

    const note = page.locator('.vault-panel .virtual-note-list .note-row', { hasText: 'Field Notes' }).first()
    await note.click()
    await expect(page.locator('.editor-panel[data-help-topic="editor"] .tab-item')).toHaveCount(2)
    await expect(page.locator('.workspace-group-heading.primary .workspace-leaf-bar')).toHaveCount(0)
  })

  test('live preview treats frontmatter as properties and GFM tasks as toggles without changing extended task syntax', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('e2e:frontmatter-populated', '1'))
    await launchApp(page)
    await waitForWorkspace(page)
    await page.locator('.editor-toolbar').getByRole('button', { name: 'Split', exact: true }).click()

    const live = page.locator('.editable-preview-pane .editable-preview-editor')
    await expect(live).toBeVisible()
    const properties = live.locator('.cm-wysiwyg-frontmatter-toggle')
    await expect(properties).toBeVisible()
    await expect(live.locator('.cm-content')).not.toContainText('project: Scriptor research')

    const task = live.locator('.cm-wysiwyg-task-toggle').first()
    await expect(task).toBeVisible()
    await expect(task).toHaveAttribute('aria-checked', 'false')
    await task.click()
    await expect.poll(async () => page.evaluate(() => {
      const editor = (window as Window & {
        __scriptorE2eEditor?: { getModel?: () => { getValue?: () => string } | null }
      }).__scriptorE2eEditor
      return editor?.getModel?.()?.getValue?.() ?? ''
    })).toContain('- [x] Collect sources')
    await expect(live.locator('.cm-line', { hasText: 'Draft methodology' })).toContainText('- [/] Draft methodology')

    await properties.click()
    await expect(live.locator('.cm-content')).toContainText('project: Scriptor research')
  })
})
