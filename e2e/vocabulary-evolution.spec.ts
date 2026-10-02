import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('vocabulary evolution measures actual sources and preserves a missing-revision gap at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await launchApp(page)
  await page.evaluate(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke(command: string, args?: Record<string, unknown>, options?: unknown): Promise<unknown> } }).__TAURI_INTERNALS__
    const original = internals.invoke.bind(internals)
    internals.invoke = async (command, args = {}, options) => {
      if (command === 'vault_list_note_history') return [
        { id: 'new', saved_at: '2026-10-02T12:00:00Z', content_hash: 'new', word_count: 999, preview: 'misleading preview' },
        { id: 'missing', saved_at: '2026-10-01T12:00:00Z', content_hash: 'missing', word_count: 999, preview: 'unavailable' },
        { id: 'old', saved_at: '2026-09-30T12:00:00Z', content_hash: 'old', word_count: 999, preview: 'misleading preview' },
      ]
      if (command === 'vault_read_note_history_revision') {
        if (args.revisionId === 'missing') throw new Error('Revision unavailable')
        return args.revisionId === 'old' ? 'apple apple' : 'apple orange pear'
      }
      return original(command, args, options)
    }
  })
  await openCommandPalette(page)
  await runCommand(page, 'Note history timeline')
  const panel = page.getByRole('dialog', { name: 'Note history', exact: true })
  const analysis = panel.getByRole('region', { name: 'Vocabulary evolution' })
  await analysis.getByRole('button', { name: 'Analyze vocabulary evolution', exact: true }).click()
  await expect(analysis.getByRole('status')).toContainText('2 measured revisions; 1 unavailable')
  await expect(analysis.getByRole('img')).toBeVisible()
  await expect(analysis.locator('svg circle')).toHaveCount(2)
  const rows = analysis.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).locator('td').nth(0)).toHaveText('2')
  await expect(rows.nth(0).locator('td').nth(1)).toHaveText('1')
  await expect(rows.nth(1).locator('td').nth(0)).toHaveText('3')
  await expect(rows.nth(1).locator('td').nth(1)).toHaveText('3')
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
