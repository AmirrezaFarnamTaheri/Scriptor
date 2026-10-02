import { test, expect } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'
test('a policy-excluded opted-in note can explicitly opt out without confusing eligibility with its field', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('e2e:research', '1'); sessionStorage.setItem('e2e:publishing-audit', '1') })
  await launchApp(page); await openCommandPalette(page); await runCommand(page, 'Publishing studio')
  const panel = page.getByRole('region', { name: 'Publishing studio', exact: true })
  await panel.getByLabel('Local site folder', { exact: true }).fill('C:/reviewed-site')
  await panel.getByRole('button', { name: 'Review publication plan', exact: true }).click()
  const row = panel.locator('tbody tr').filter({ hasText: 'Research Plan.md' })
  await expect(row).toContainText('Excluded by the current plan')
  await row.getByRole('button', { name: 'Opt out Research Plan.md', exact: true }).click()
  await expect(panel.getByRole('status').filter({ hasText: 'Note excluded from the next publication plan' })).toBeVisible()
  const mutations = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:research-calls') ?? '[]') as Array<{cmd: string; payload: Record<string, unknown>}>).filter(call => call.cmd === 'vault_frontmatter_set'))
  expect(mutations).toHaveLength(1)
  expect(mutations[0].payload.field).toBe('publish')
  expect(mutations[0].payload.value).toBe('false')
  expect(mutations[0].payload.expectedVaultId).toBe('screenshot-vault')
  expect(mutations[0].payload.expectedContentHash).toBeTruthy()
})
