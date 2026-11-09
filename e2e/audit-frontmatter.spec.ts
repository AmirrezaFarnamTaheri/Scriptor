import { expect, test, type Page } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

async function openFrontmatter(page: Page) {
  await page.addInitScript(() => { sessionStorage.setItem('e2e:frontmatter-populated', '1') })
  await launchApp(page)
  await waitForWorkspace(page)
  await page.getByRole('button', { name: 'Tools', exact: true }).click()
  await page.getByRole('menuitem', { name: /Frontmatter/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Frontmatter', exact: true })
  await expect(dialog.getByLabel('project', { exact: true })).toHaveValue('Scriptor research')
  return dialog
}

test('one Save changes button persists multiple edited fields with a note revision', async ({ page }) => {
  const dialog = await openFrontmatter(page)
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await expect(dialog.locator('.frontmatter-fields > li button')).toHaveCount(0)
  await page.evaluate(() => {
    const native = (window as Window & { __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!native) throw new Error('Expected native fixture')
    const original = native.invoke.bind(native)
    native.invoke = async (command, args = {}) => {
      if (command === 'vault_save_note' || command === 'vault_frontmatter_set') {
        const captured = JSON.parse(sessionStorage.getItem('e2e:frontmatter-mutations') ?? '[]')
        captured.push({ command, args })
        sessionStorage.setItem('e2e:frontmatter-mutations', JSON.stringify(captured))
      }
      return original(command, args)
    }
  })
  await dialog.getByLabel('project', { exact: true }).fill('New research plan')
  await dialog.getByLabel('status', { exact: true }).fill('reviewed')
  await expect(dialog.getByText('2 unsaved fields')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const mutations = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:frontmatter-mutations') ?? '[]') as Array<{ command: string; args: { markdown?: string; expectedContentHash?: string; expectedVaultId?: string } }>)
  expect(mutations).toHaveLength(1)
  expect(mutations[0]?.command).toBe('vault_save_note')
  expect(mutations[0]?.args.markdown).toContain('project: "New research plan"')
  expect(mutations[0]?.args.markdown).toContain('status: reviewed')
  expect(mutations[0]?.args.expectedVaultId).toBe('screenshot-vault')
  expect(mutations[0]?.args.expectedContentHash).toBe('hash-frontmatter-visual-fixture')
})

test('a content-hash conflict keeps all metadata edits visible for review', async ({ page }) => {
  const dialog = await openFrontmatter(page)
  await dialog.getByLabel('project', { exact: true }).fill('Retained draft')
  await page.evaluate(() => sessionStorage.setItem('e2e:hash-mismatch', '1'))
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(/hash|changed|save/i)
  await expect(dialog.getByLabel('project', { exact: true })).toHaveValue('Retained draft')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
})

test('closing dirty metadata requires an explicit discard decision', async ({ page }) => {
  const dialog = await openFrontmatter(page)
  await dialog.getByLabel('status', { exact: true }).fill('reviewed')
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
  await expect(dialog.getByText('Discard your unsaved metadata changes?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog.getByLabel('status', { exact: true })).toHaveValue('reviewed')
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click()
  await dialog.getByRole('button', { name: 'Discard changes' }).click()
  await expect(dialog).toHaveCount(0)
})
