import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('Quick capture task buttons identify the intended task and never affect a neighbor', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Quick capture (scratchpad & todos)')
  const capture = page.locator('.quick-capture-panel')
  await expect(capture).toBeVisible()
  const taskInput = capture.getByRole('textbox', { name: 'New task', exact: true })
  for (const title of ['Review first draft', 'Check references']) {
    await taskInput.fill(title)
    await taskInput.press('Enter')
  }
  const rows = capture.locator('.quick-todo-list li')
  await expect(rows).toHaveCount(2)

  await expect(rows.nth(0).getByRole('button', { name: 'Delete task: Review first draft', exact: true })).toBeVisible()
  await expect(rows.nth(1).getByRole('button', { name: 'Delete task: Check references', exact: true })).toBeVisible()
  await rows.nth(1).getByRole('button', { name: 'Mark task complete: Check references', exact: true }).click()
  await expect(rows.nth(1)).toHaveClass(/done/)
  await expect(rows.nth(0)).not.toHaveClass(/done/)
  await expect(rows.nth(1).getByRole('button', { name: 'Mark task incomplete: Check references', exact: true })).toBeVisible()

  await rows.nth(1).getByRole('button', { name: 'Delete task: Check references', exact: true }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first().getByRole('textbox', { name: 'Task text: Review first draft', exact: true })).toHaveValue('Review first draft')
})
