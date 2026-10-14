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
  // The native scan should include the new note, and the inbox should expose it.
  await expect(page.locator('.inbox-panel .note-row', { hasText: 'Untitled' })).toBeVisible()
})


test('preview shortcut opens a side leaf for an already-open note and closes without removing its editor tab', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.vault-panel .virtual-note-list').getByRole('button', { name: 'Field Notes.md' }).click()
  const writingTabs = page.getByRole('group', { name: 'Editor tabs', exact: true })
  const field = writingTabs.getByRole('tab', { name: 'Field Notes', exact: true })
  await expect(field).toBeVisible()

  const shortcuts = page.locator('.workspace-activity-bar')
  await shortcuts.getByRole('button', { name: 'Note preview', exact: true }).click()
  const preview = page.locator('.workspace-leaf-content.secondary .workspace-note-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Field Notes.md')
  await expect(field).toBeVisible()

  await page.locator('.workspace-group-heading.secondary').getByRole('button', { name: 'Close Field Notes.md' }).click()
  await expect(preview).toHaveCount(0)
  await expect(field).toBeVisible()
})


test('closing a writing tab does not remove its independently docked note preview', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.vault-panel .virtual-note-list').getByRole('button', { name: 'Field Notes.md' }).click()
  await page.locator('.workspace-activity-bar').getByRole('button', { name: 'Note preview', exact: true }).click()
  const preview = page.locator('.workspace-leaf-content.secondary .workspace-note-preview')
  await expect(preview).toBeVisible()

  const writingTabs = page.getByRole('group', { name: 'Editor tabs', exact: true })
  await writingTabs.getByRole('button', { name: 'Close Field Notes', exact: true }).click()
  await expect(writingTabs.getByRole('tab', { name: 'Field Notes', exact: true })).toHaveCount(0)
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('Field Notes.md')
})


test('virtual vault note rows respect mobile touch target height without overlapping', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.addInitScript(() => window.sessionStorage.setItem('e2e:large-vault', '1'))
  await launchApp(page)
  // At mobile widths the vault is intentionally hidden until selected.
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await page.getByRole('navigation', { name: 'Mobile workspace navigation', exact: true })
    .getByRole('button', { name: 'Vault', exact: true }).click()
  await expect(page.locator('.vault-panel .virtual-note-list')).toBeVisible()

  const geometry = () => page.evaluate(() => {
    const lists = [...document.querySelectorAll<HTMLUListElement>('.vault-panel .virtual-note-list')]
    const list = lists.find(candidate => candidate.querySelectorAll(':scope > li').length >= 2)
    if (!list) return null
    const first = list.querySelector<HTMLLIElement>(':scope > li:first-child')
    const second = list.querySelector<HTMLLIElement>(':scope > li:nth-child(2)')
    const button = first?.querySelector<HTMLButtonElement>('.note-row')
    if (!first || !second || !button) return null
    const a = first.getBoundingClientRect()
    const b = second.getBoundingClientRect()
    const target = button.getBoundingClientRect()
    return { targetHeight: target.height, rowStride: b.top - a.top, overlap: target.bottom - b.top }
  })
  await expect.poll(async () => (await geometry())?.targetHeight ?? 0).toBeGreaterThanOrEqual(44)
  await expect.poll(async () => (await geometry())?.overlap ?? 100).toBeLessThanOrEqual(1)
  // Overscan rows may be outside the viewport. Their intrinsic placeholder
  // must not reset mobile row spacing when the user scrolls a large vault.
  await page.evaluate(() => {
    const lists = [...document.querySelectorAll<HTMLUListElement>('.vault-panel .virtual-note-list')]
    const scrolling = lists.map(list => list.parentElement).find(element => element && element.scrollHeight > element.clientHeight + 200)
    if (scrolling) scrolling.scrollTop = scrolling.scrollHeight / 2
  })
  await expect.poll(async () => (await geometry())?.overlap ?? 100).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 1024, height: 800 })
  await expect.poll(async () => {
    const result = await geometry()
    return result ? result.rowStride >= result.targetHeight - 1 : false
  }).toBe(true)
})

test('side note preview follows unsaved writing changes instead of displaying stale disk markdown', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('.vault-panel .virtual-note-list').getByRole('button', { name: 'Field Notes.md' }).click()
  await page.locator('.editor-toolbar').getByRole('button', { name: 'Tools', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Switch to CodeMirror editor' }).click()
  await page.locator('.workspace-activity-bar').getByRole('button', { name: 'Note preview', exact: true }).click()
  const side = page.locator('.workspace-leaf-content.secondary .workspace-note-preview')
  await expect(side).toBeVisible()
  await expect(side.locator('article.markdown-preview')).toBeVisible()
  await page.locator('.workspace-writing-leaf .cm-content').fill('# Live draft check\n\nNew unsaved preview content.')
  await expect(side.getByRole('heading', { name: 'Live draft check' })).toBeVisible()
  await expect(side).toContainText('New unsaved preview content.')
})

test('selecting the already-active note from graph returns to writing when a tool owns the primary pane', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await openCommandPalette(page)
  await runCommand(page, 'Diagram studio')
  const diagram = page.getByRole('region', { name: 'Diagram studio', exact: true })
  await expect(diagram).toBeVisible()
  await page.getByRole('button', { name: 'Move tab to main workspace', exact: true }).click()
  await expect(page.locator('.workspace-writing-leaf')).toBeHidden()

  await openCommandPalette(page)
  await runCommand(page, 'Open graph')
  const graph = page.getByRole('dialog', { name: 'Knowledge graph' })
  await expect(graph).toBeVisible()
  const surface = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas').first()
  await expect(surface).toBeVisible()
  await surface.focus()
  await page.keyboard.press('ArrowRight')
  await expect(graph.locator('[aria-live="polite"]')).toContainText('Field Notes')
  await page.keyboard.press('ArrowDown')
  await expect(graph.locator('[aria-live="polite"]')).toContainText('Research Plan')
  await page.keyboard.press('Enter')
  await graph.getByRole('button', { name: 'Close graph' }).click()

  const writer = page.locator('.workspace-writing-leaf .editor-panel[data-help-topic="editor"]')
  await expect(writer).toBeVisible()
  await expect(writer.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible()
})
