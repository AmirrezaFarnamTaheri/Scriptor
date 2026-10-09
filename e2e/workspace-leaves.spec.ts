import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'
import { attachVisualState } from './visual-state-evidence'

test('workspace groups retain drafts, move tabs and restore inert references', async ({ page }, testInfo) => {
  await launchApp(page)
  const activity = page.getByRole('navigation', { name: 'Workspaces', exact: true })
  await openCommandPalette(page)
  await runCommand(page, 'Diagram studio')
  const diagram = page.getByRole('region', { name: 'Diagram studio', exact: true })
  await expect(diagram).toBeVisible()
  await diagram.getByLabel('Diagram source', { exact: true }).fill('flowchart LR\n D[Kept draft] --> E[Evidence]')
  await activity.getByRole('button', { name: 'Source file', exact: true }).click()
  await expect(diagram).toBeHidden()
  await page.getByRole('tab', { name: 'Diagram studio', exact: true }).click()
  await expect(diagram.getByLabel('Diagram source', { exact: true })).toHaveValue(/Kept draft/)
  await page.getByRole('button', { name: 'Move tab to main workspace', exact: true }).click()
  await expect(page.locator('[data-leaf-id="feature:open-diagram-studio"]')).toHaveClass(/primary/)
  await attachVisualState(page, testInfo, 'workspace-leaf-moved-primary-with-draft', page.locator('.workspace-leaf-dock'))
  await page.reload()
  await expect(page.getByRole('tab', { name: 'Diagram studio', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Diagram studio', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-leaf-id="feature:open-diagram-studio"]').getByText('Saved tab. Select it to open its workspace.')).toBeVisible()
  await attachVisualState(page, testInfo, 'workspace-leaves-restored-inert', page.locator('.workspace-leaf-dock'))
  await page.getByRole('tab', { name: 'Diagram studio', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Diagram studio', exact: true })).toBeVisible()
})

test('workspace tabs remain bounded and keyboard reachable in narrow RTL layouts', async ({ page }, testInfo) => {
  await launchApp(page)
  await page.setViewportSize({ width: 375, height: 900 })
  await page.evaluate(() => { document.documentElement.dir = 'rtl' })
  const activity = page.getByRole('navigation', { name: 'Workspaces', exact: true })
  await openCommandPalette(page)
  await runCommand(page, 'Diagram studio')
  await activity.getByRole('button', { name: 'Source file', exact: true }).click()
  const tab = page.getByRole('tab', { name: 'Diagram studio', exact: true })
  await tab.focus()
  await tab.press('Enter')
  await expect(page.getByRole('region', { name: 'Diagram studio', exact: true })).toBeVisible()
  const metrics = await page.locator('.workspace-leaf-dock').evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { width: bounds.width, right: bounds.right, viewport: innerWidth, buttons: [...element.querySelectorAll<HTMLButtonElement>('.workspace-leaf-actions button')].filter(button => button.getClientRects().length).map(button => button.getBoundingClientRect().height) }
  })
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport + 1)
  expect(metrics.buttons.every(height => height >= 44)).toBe(true)
  await attachVisualState(page, testInfo, 'workspace-leaves-narrow-rtl', page.locator('.workspace-leaf-dock'))
})

test('failed note restoration keeps its activation prompt and preserves the current editor', async ({ page }, testInfo) => {
  await launchApp(page)
  await page.evaluate(() => {
    const id = 'note:Methodology.md'
    localStorage.setItem('scriptor:workspace-leaves:v1:screenshot-vault', JSON.stringify({ version: 1, leaves: [{ id, reference: { kind: 'note', path: 'Methodology.md' }, group: 'primary' }], activeId: id, activeByGroup: { primary: id, secondary: null } }))
  })
  await page.reload()
  const leaf = page.locator('[data-leaf-id="note:Methodology.md"]')
  await expect(leaf.getByText('Saved tab. Select it to open its workspace.')).toBeVisible()
  const before = await page.locator('.workspace-writing-leaf .editor-status').textContent()
  await page.evaluate(() => {
    const native = (window as Window & { __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture unavailable')
    const original = native.invoke.bind(native)
    native.invoke = (command, args) => command === 'vault_read_note' && args?.path === 'Methodology.md' ? Promise.reject(new Error('Read unavailable')) : original(command, args)
  })
  await page.getByRole('tab', { name: 'Methodology.md', exact: true }).click()
  await expect(leaf.getByText('Saved tab. Select it to open its workspace.')).toBeVisible()
  await expect(page.locator('.workspace-writing-leaf')).toBeHidden()
  expect(await page.locator('.workspace-writing-leaf .editor-status').textContent()).toBe(before)
  await attachVisualState(page, testInfo, 'workspace-note-restoration-failure', leaf)
})
