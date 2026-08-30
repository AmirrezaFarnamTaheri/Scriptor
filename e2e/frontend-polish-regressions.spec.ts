import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { selectGitPanelState } from '../src/lib/gitPanelState'
import type { GitStatus } from '../src/types/vault'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

const OPEN_GIT = 'Open Git panel'
const OPEN_READER = 'Open reader'
const OPEN_TASKS = 'Open tasks panel'
const OPEN_KANBAN = 'Open kanban board'

const READY_STATUS: GitStatus = {
  is_repo: true,
  branch: 'main',
  changed_files: [],
  clean: true,
  ahead: 0,
  behind: 0,
  has_upstream: true,
  has_conflicts: false,
  conflicted_files: [],
}

/** Opens the Git panel through the same command-palette flow used by users. */
async function openGitPanel(page: Page) {
  await launchApp(page)
  await settleLayout(page)
  await openCommandPalette(page)
  await runCommand(page, OPEN_GIT)
  const panel = page.getByRole('dialog', { name: 'Git', exact: true })
  await expect(panel).toBeVisible({ timeout: 45_000 })
  return panel
}

test.describe('Git panel state selector', () => {
  test('distinguishes loading, idle, error, non-repository, and ready states', () => {
    expect(selectGitPanelState(null, null, true)).toBe('loading')
    expect(selectGitPanelState(null, null, false)).toBe('not-repository')
    expect(selectGitPanelState(null, 'bridge unavailable', false)).toBe('error')
    expect(selectGitPanelState(READY_STATUS, 'bridge unavailable', true)).toBe('loading')
    expect(selectGitPanelState({ ...READY_STATUS, is_repo: false }, null, false)).toBe('not-repository')
    expect(selectGitPanelState(READY_STATUS, null, false)).toBe('ready')
  })
})

test.describe('Frontend polish regressions', () => {
  test('workspace and status dock reflow without covering the editor at intermediate widths', async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 900 })
    await launchApp(page)
    await waitForWorkspace(page)

    const workspace = page.locator('.workspace-grid')
    const editor = page.locator('.editor-panel')
    const inspector = page.locator('.inspector-panel')
    const status = page.locator('.status-strip')
    const dock = page.locator('.bottom-tabs-wrap')
    const outputTab = page.getByRole('tab', { name: 'Output' })

    await expect(outputTab).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#dock-panel-output')).toHaveCount(0)

    await expect
      .poll(async () =>
        page.evaluate(() => ({
          viewportHeight: document.documentElement.clientHeight,
          viewportWidth: document.documentElement.clientWidth,
          pageHeight: document.documentElement.scrollHeight,
          pageWidth: document.documentElement.scrollWidth,
        })),
      )
      .toEqual({ viewportHeight: 900, viewportWidth: 1240, pageHeight: 900, pageWidth: 1240 })

    const [workspaceBox, editorBox, inspectorBox, statusBox, dockBox] = await Promise.all([
      workspace.boundingBox(),
      editor.boundingBox(),
      inspector.boundingBox(),
      status.boundingBox(),
      dock.boundingBox(),
    ])
    expect(workspaceBox).not.toBeNull()
    expect(editorBox).not.toBeNull()
    expect(inspectorBox).not.toBeNull()
    expect(statusBox).not.toBeNull()
    expect(dockBox).not.toBeNull()
    expect((editorBox?.x ?? 0) + (editorBox?.width ?? 0)).toBeLessThanOrEqual(1240)
    expect((inspectorBox?.x ?? 0) + (inspectorBox?.width ?? 0)).toBeLessThanOrEqual(1240)
    expect(dockBox?.x).toBeCloseTo((statusBox?.x ?? 0) + 12, 0)
    expect(dockBox?.width ?? 0).toBeGreaterThan((statusBox?.width ?? 0) * 0.9)

    await outputTab.click()
    await expect(outputTab).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#dock-panel-output')).toBeVisible()

    await page.getByRole('button', { name: 'Hide status dock' }).click()
    await expect(dock).toHaveCount(0)

    await page.getByRole('button', { name: 'Show status dock' }).click()
    await expect(dock).toBeVisible()
    await expect(outputTab).toHaveAttribute('aria-expanded', 'true')
  })

  test('top actions wrap without clipping their icons at a compact desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1126, height: 900 })
    await launchApp(page)
    await waitForWorkspace(page)

    await expect
      .poll(() =>
        page.locator('.top-actions').evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        })),
      )
      .toEqual(expect.objectContaining({ clientWidth: expect.any(Number), scrollWidth: expect.any(Number) }))

    const actionsFit = await page.locator('.top-actions').evaluate((element) => {
      const container = element.getBoundingClientRect()
      return Array.from(element.querySelectorAll('button')).every(
        (button) => button.getBoundingClientRect().right <= container.right + 1,
      )
    })
    expect(actionsFit).toBe(true)

    const [editorBox, inspectorBox] = await Promise.all([
      page.locator('.editor-panel').boundingBox(),
      page.locator('.inspector-panel').boundingBox(),
    ])
    expect((editorBox?.x ?? 0) + (editorBox?.width ?? 0)).toBeLessThanOrEqual(1126)
    expect((inspectorBox?.x ?? 0) + (inspectorBox?.width ?? 0)).toBeLessThanOrEqual(1126)
  })

  test('high app zoom switches write and inspector into exclusive panes', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('scriptor:ui-zoom', '2'))
    await launchApp(page)
    await expect(page.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible({ timeout: 30_000 })
    await settleLayout(page)

    await expect(page.locator('html')).toHaveAttribute('data-ui-reflow', 'mobile')
    const nav = page.getByRole('navigation', { name: 'Mobile workspace navigation' })
    await expect(nav).toBeVisible()
    await expect(page.locator('.editor-panel')).toBeVisible()
    await expect(page.locator('.inspector-panel')).toBeHidden()

    await nav.getByRole('button', { name: 'Lens' }).click()
    await expect(page.locator('.editor-panel')).toBeHidden()
    await expect(page.locator('.inspector-panel')).toBeVisible()
    await expect(page.locator('.inspector-panel')).toBeInViewport()
  })

  test('vault tree opens supported reader documents directly in the reader panel', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)

    await page.getByRole('button', { name: 'Research Paper.pdf' }).click()

    const reader = page.getByRole('dialog', { name: 'Reader', exact: true })
    await expect(reader).toBeVisible()
    await expect(reader).toContainText('Research Paper.pdf')
    await expect(reader.locator('iframe[title*="Research Paper.pdf"]')).toBeVisible()
  })

  test('palette mounts reader, tasks, and kanban when their UI contracts are available', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)

    await openCommandPalette(page)
    await runCommand(page, OPEN_READER)
    await expect(page.getByRole('dialog', { name: 'Reader', exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Close Reader/i }).click()

    await openCommandPalette(page)
    await runCommand(page, OPEN_TASKS)
    const tasks = page.getByRole('dialog', { name: 'Tasks', exact: true })
    await expect(tasks).toBeVisible()
    await expect(tasks).toContainText('Collect sources')
    await page.getByRole('button', { name: 'Close Tasks' }).click()

    await page.getByRole('button', { name: 'Sprint Board.md' }).click()
    await openCommandPalette(page)
    await runCommand(page, OPEN_KANBAN)
    const kanban = page.getByRole('dialog', { name: 'Sprint Board', exact: true })
    await expect(kanban).toBeVisible()
    await expect(kanban).toContainText('Sprint Board')
  })

  test('task status and due-date writes survive an authoritative Markdown reload', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, OPEN_TASKS)

    const tasks = page.getByRole('dialog', { name: 'Tasks', exact: true })
    const task = tasks.getByRole('listitem').filter({ hasText: 'Collect sources' })
    await task.getByRole('button', { name: 'Status: open. Click to advance.' }).click()
    await expect(task.getByRole('button', { name: 'Status: in-progress. Click to advance.' })).toBeVisible()

    await task.getByRole('button', { name: 'Due date: 2026-06-30' }).click()
    const dueDate = task.getByRole('textbox', { name: 'Edit due date' })
    await dueDate.fill('2026-07-15')
    await dueDate.press('Enter')
    await expect(task.getByRole('button', { name: 'Due date: 2026-07-15' })).toBeVisible()

    await tasks.getByRole('button', { name: 'Refresh task list' }).click()
    await expect(task.getByRole('button', { name: 'Status: in-progress. Click to advance.' })).toBeVisible()
    await expect(task.getByRole('button', { name: 'Due date: 2026-07-15' })).toBeVisible()
  })

  test('task mutation failure is visible and a subsequent retry writes the Markdown source', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('e2e:task-update-failure', '1'))
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, OPEN_TASKS)

    const tasks = page.getByRole('dialog', { name: 'Tasks', exact: true })
    const task = tasks.getByRole('listitem').filter({ hasText: 'Collect sources' })
    const status = task.getByRole('button', { name: 'Status: open. Click to advance.' })
    await status.click()
    await expect(tasks).toContainText('E2E task write unavailable')

    await page.evaluate(() => window.sessionStorage.removeItem('e2e:task-update-failure'))
    await status.click()
    await expect(task.getByRole('button', { name: 'Status: in-progress. Click to advance.' })).toBeVisible()
    await tasks.getByRole('button', { name: 'Refresh task list' }).click()
    await expect(task.getByRole('button', { name: 'Status: in-progress. Click to advance.' })).toBeVisible()
  })

  test('kanban keyboard move reloads the Markdown-derived board in its destination column', async ({ page }) => {
    await launchApp(page)
    // Set this after launch so the app bootstrap cannot replace the test hook
    // while resetting browser state for a reused Playwright worker.
    await page.evaluate(() => window.sessionStorage.setItem('e2e:kanban-move-delay', '1'))
    await settleLayout(page)
    await page.getByRole('button', { name: 'Sprint Board.md' }).click()
    await openCommandPalette(page)
    await runCommand(page, OPEN_KANBAN)

    const board = page.getByRole('dialog', { name: 'Sprint Board', exact: true })
    const todo = board.getByRole('list', { name: 'Todo column' })
    const doing = board.getByRole('list', { name: 'Doing column' })
    await todo.getByRole('button', { name: 'Move Draft release notes right' }).click()
    await expect(board).toContainText('Moving card and refreshing board…')
    await expect(doing.getByRole('listitem').filter({ hasText: 'Draft release notes' })).toBeVisible()
    await expect(todo.getByRole('listitem').filter({ hasText: 'Draft release notes' })).toHaveCount(0)

    await board.getByRole('button', { name: 'Refresh kanban board' }).click()
    await expect(doing.getByRole('listitem').filter({ hasText: 'Draft release notes' })).toBeVisible()
  })

  test('Git file actions are not nested inside the checkbox label', async ({ page }) => {
    const panel = await openGitPanel(page)
    const row = panel.locator('.git-changes li').first()
    await expect(row.locator('.git-file-selection label button')).toHaveCount(0)
    await expect(row.locator('.git-file-row-actions button')).toHaveCount(2)
  })

  test('Git shortcut is exposed in the accessible name and visual tooltip is hidden', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)

    const gitButton = page.getByRole('button', { name: /(?:⌘⌥G|Ctrl\+Alt\+G)/i })
    await expect(gitButton).toBeVisible()
    await expect(gitButton.locator('.custom-tooltip')).toHaveAttribute('aria-hidden', 'true')

    await page.keyboard.press('Control+Alt+KeyG')
    await expect(page.getByRole('dialog', { name: 'Git', exact: true })).toBeVisible()
  })

  test('configured sidebar and inspector shortcuts execute their advertised actions', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    const workspace = page.locator('.workspace-grid')

    await expect(workspace).toHaveAttribute('data-vault-collapsed', 'false')
    await page.keyboard.press('Control+Alt+KeyB')
    await expect(workspace).toHaveAttribute('data-vault-collapsed', 'true')

    await expect(workspace).toHaveAttribute('data-inspector-collapsed', 'false')
    await page.keyboard.press('Control+Alt+KeyL')
    await expect(workspace).toHaveAttribute('data-inspector-collapsed', 'true')
  })

  test('global shortcuts ignore explicit, plaintext-only, empty, and inherited editable targets', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    const workspace = page.locator('.workspace-grid')

    await expect(workspace).toHaveAttribute('data-vault-collapsed', 'false')
    for (const variant of ['true', 'plaintext-only', 'empty', 'inherited']) {
      await page.evaluate((editableVariant) => {
        document.querySelector('#shortcut-edit-fixture')?.remove()
        const fixture = document.createElement('div')
        fixture.id = 'shortcut-edit-fixture'

        const target = document.createElement('span')
        target.id = 'shortcut-edit-target'
        target.tabIndex = 0
        target.textContent = 'Editable shortcut fixture'

        if (editableVariant === 'inherited') {
          fixture.setAttribute('contenteditable', 'true')
          fixture.append(target)
        } else {
          target.setAttribute('contenteditable', editableVariant === 'empty' ? '' : editableVariant)
          fixture.append(target)
        }

        document.body.append(fixture)
        target.focus()
      }, variant)

      await expect(page.locator('#shortcut-edit-target')).toBeFocused()
      await page.keyboard.press('Control+Alt+KeyB')
      await expect(workspace).toHaveAttribute('data-vault-collapsed', 'false')
    }

    await page.evaluate(() => document.querySelector('#shortcut-edit-fixture')?.remove())
  })

  test('explicitly clearing Git selection leaves commit disabled', async ({ page }) => {
    const panel = await openGitPanel(page)
    const checkbox = panel.locator('.git-file-selection input[type="checkbox"]').first()
    await expect(checkbox).toBeChecked()
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
    await expect(panel.getByRole('button', { name: 'Commit selected' })).toBeDisabled()
  })

  test('Git status failure is distinct from non-repository and retry recovers', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('e2e:git-status-failure', '1'))
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, OPEN_GIT)

    const panel = page.getByRole('dialog', { name: 'Git', exact: true })
    await expect(panel).toContainText('Git status unavailable')
    await expect(panel).toContainText('E2E Git bridge unavailable')
    const retry = panel.getByRole('button', { name: 'Retry' })
    await expect(retry).toBeEnabled()

    await page.evaluate(() => window.sessionStorage.removeItem('e2e:git-status-failure'))
    await retry.click()
    await expect(panel).toContainText(/Working tree|changed file/i)
  })

  test('store surface owns live MCP and feature controls', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)

    await page.getByRole('tab', { name: 'Plugins' }).click()
    await page.getByRole('tab', { name: 'MCP' }).click()
    const readOnlyMode = page.getByRole('radio', { name: /Read-Only/i })
    await expect(readOnlyMode).toBeEnabled()
    await readOnlyMode.click()
    await expect(readOnlyMode).toHaveAttribute('aria-checked', 'true')

    await page.getByRole('tab', { name: 'Features' }).click()
    await expect(page.getByRole('button', { name: 'Toggle Vault file watcher' })).toBeEnabled()
  })
})
