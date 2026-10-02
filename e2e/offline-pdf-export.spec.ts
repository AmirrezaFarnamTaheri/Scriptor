import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('offline export uses a vault-bound editor snapshot and exposes bundled redistribution notices', async ({ page }) => {
  await launchApp(page)
  await page.evaluate(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke(command: string, args?: Record<string, unknown>, options?: unknown): Promise<unknown> } }).__TAURI_INTERNALS__
    const original = internals.invoke.bind(internals)
    internals.invoke = async (command, args = {}, options) => {
      if (command === 'export_pdf_inprocess') {
        sessionStorage.setItem('e2e:offline-pdf-request', JSON.stringify(args))
        await new Promise(resolve => setTimeout(resolve, 1200))
        return { artifact_path: 'C:/vault/.scriptor/exports/offline/test.pdf', page_count: 2, warnings: ['Fixture image warning'], duration_ms: 1200 }
      }
      if (command === 'export_pdf_licenses') return 'Fixture redistribution notice: SIL Open Font License'
      return original(command, args, options)
    }
  })
  await openCommandPalette(page)
  await runCommand(page, 'Open publish center')
  const panel = page.getByRole('dialog', { name: 'Export & publish', exact: true })
  const row = panel.locator('.publish-profile-list > li').filter({ hasText: 'PDF · Offline' })
  await expect(row.getByRole('button', { name: 'Preview export', exact: true })).toBeDisabled()
  await row.getByRole('button', { name: 'Export PDF', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Typesetting offline PDF')
  await expect(panel.getByRole('button', { name: 'Cancel export', exact: true })).toHaveCount(0)
  await expect(panel.locator('.publish-status-success')).toBeVisible()
  const request = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:offline-pdf-request') ?? 'null') as { expectedVaultId: string; notePath: string; sourceMarkdown: string })
  expect(request.expectedVaultId).toBe('screenshot-vault')
  expect(request.notePath).toMatch(/\.md$/)
  expect(request.sourceMarkdown).toContain('#')
  await panel.getByText('Offline PDF fonts and third-party notices', { exact: true }).click()
  await panel.getByRole('button', { name: 'Read redistribution notices', exact: true }).click()
  await expect(panel.getByText('Fixture redistribution notice: SIL Open Font License', { exact: true })).toBeVisible()
})
