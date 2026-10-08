import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, waitForWorkspace } from './helpers'

test('palette chord opens from CodeMirror without running the editor binding', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('scriptor:editor-mode', 'codemirror'))
  await launchApp(page)
  await waitForWorkspace(page)
  const editor = page.locator('.workspace-writing-leaf .cm-content')
  await editor.focus()
  const before = await editor.textContent()
  await page.keyboard.press('Control+KeyK')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible()
  await expect(palette.getByRole('searchbox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await expect(editor).toBeFocused()
  expect(await editor.textContent()).toBe(before)
})

test('palette chord leaves an active customization modal in control of its fields', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Customize workspace shortcuts')
  const dialog = page.getByRole('dialog', { name: 'Customize workspace shortcuts', exact: true })
  const field = dialog.locator('[data-shortcut-id="writing"]').getByLabel('Button name', { exact: true })
  await field.focus()
  await page.keyboard.press('Control+KeyK')
  await expect(dialog).toBeVisible()
  await expect(field).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0)
})
