import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

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
    await expect(live.locator('.cm-line', { hasText: 'Collect sources' })).not.toContainText('- [')
    await task.click()
    await expect.poll(async () => page.evaluate(() => {
      const editor = (window as Window & {
        __scriptorE2eEditor?: { getModel?: () => { getValue?: () => string } | null }
      }).__scriptorE2eEditor
      return editor?.getModel?.()?.getValue?.() ?? ''
    })).toContain('- [x] Collect sources')
    // The same control must remain keyboard-focusable after its decoration updates.
    await task.focus()
    await task.press('Space')
    await expect(task).toBeFocused()
    await expect(task).toHaveAttribute('aria-checked', 'false')
    await expect(live.locator('.cm-line', { hasText: 'Draft methodology' })).toContainText('- [/] Draft methodology')

    await properties.click()
    await expect(live.locator('.cm-content')).toContainText('project: Scriptor research')
  })
})


test('editor note tabs navigate in visual direction for RTL keyboards', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.vault-panel .virtual-note-list').getByRole('button', { name: 'Field Notes.md' }).click()
  await page.locator('html').evaluate(element => { element.dir = 'rtl' })
  const tabs = page.getByRole('group', { name: 'Editor tabs', exact: true })
  const field = tabs.getByRole('tab', { name: 'Field Notes', selected: true })
  await field.focus()
  await field.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Research Plan', selected: true })).toBeFocused()
})

test('filtering a scrolled large vault resets stale virtualization offsets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => window.sessionStorage.setItem('e2e:large-vault', '1'))
  await launchApp(page)
  await waitForWorkspace(page)
  const list = page.locator('.vault-panel .virtual-note-list').first()
  const scroller = list.locator('xpath=..')
  await scroller.evaluate(element => { element.scrollTop = element.scrollHeight })
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(200)
  await page.locator('.vault-panel').getByRole('searchbox', { name: 'Search notes' }).fill('Research Plan')
  await expect.poll(() => list.evaluate(element => element.children.length)).toBeGreaterThan(0)
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBe(0)
  await expect(list.getByRole('button', { name: 'Research Plan.md' })).toBeVisible()
})


test('restored active note reuses the editor session instead of an unreachable inert leaf', async ({ page }) => {
  await page.addInitScript(() => {
    const id = 'note:Research Plan.md'
    localStorage.setItem('scriptor:workspace-leaves:v1:screenshot-vault', JSON.stringify({
      version: 1,
      leaves: [{ id, reference: { kind: 'note', path: 'Research Plan.md' }, group: 'primary' }],
      activeId: id,
      activeByGroup: { primary: id, secondary: null },
    }))
  })
  await launchApp(page)
  await waitForWorkspace(page)

  const editor = page.locator('.workspace-writing-leaf .editor-panel[data-help-topic="editor"]')
  await expect(editor).toBeVisible()
  await expect(page.locator('[data-leaf-id="note:Research Plan.md"]')).toHaveCount(0)
  await expect(page.locator('.workspace-group-heading.primary .workspace-leaf-bar')).toHaveCount(0)
})


test('creating a note while a tool occupies the main workspace returns to writing', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Diagram studio')
  const diagram = page.getByRole('region', { name: 'Diagram studio', exact: true })
  await expect(diagram).toBeVisible()
  await page.getByRole('button', { name: 'Move tab to main workspace', exact: true }).click()
  await expect(page.locator('[data-leaf-id="feature:open-diagram-studio"]')).toHaveClass(/primary/)

  await page.locator('.vault-sidebar-footer').getByRole('button', { name: 'New note' }).click()
  const editor = page.locator('.workspace-writing-leaf .editor-panel[data-help-topic="editor"]')
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('tab', { selected: true }).first()).toContainText('Untitled')
})


test('preview shortcut opens a side leaf for an already-open note and closes without removing its editor tab', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.vault-panel .virtual-note-list').getByRole('button', { name: 'Field Notes.md' }).click()
  const writingTabs = page.getByRole('group', { name: 'Editor tabs', exact: true })
  const field = writingTabs.getByRole('tab', { name: 'Field Notes', exact: true })
  await expect(field).toBeVisible()

  const shortcuts = page.locator('.workspace-activity-bar')
  await shortcuts.getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.locator('.workspace-leaf-content.secondary .workspace-note-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Field Notes.md')
  await expect(field).toBeVisible()

  await page.locator('.workspace-group-heading.secondary').getByRole('button', { name: 'Close Field Notes.md' }).click()
  await expect(preview).toHaveCount(0)
  await expect(field).toBeVisible()
})
