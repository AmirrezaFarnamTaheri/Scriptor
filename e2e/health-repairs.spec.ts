import { expect, test, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

async function openRepairs(page: Page, theme: 'light' | 'dark' = 'light') {
  await launchApp(page, { theme })
  if (await page.locator('html').getAttribute('data-appearance') !== theme) {
    await page.locator('header.topbar').getByRole('button', { name: new RegExp(`Switch to ${theme} appearance`) }).click()
  }
  await expect(page.locator('html')).toHaveAttribute('data-appearance', theme)
  await page.evaluate(() => {
    const internals = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
    if (!internals?.invoke) throw new Error('E2E native bridge unavailable')
    const original = internals.invoke.bind(internals)
    const receipts: unknown[] = []
    internals.invoke = async (command, args = {}, options) => {
      if (command.startsWith('health_repair_')) {
        const calls = JSON.parse(sessionStorage.getItem('e2e:health-calls') ?? '[]')
        calls.push({ command, args }); sessionStorage.setItem('e2e:health-calls', JSON.stringify(calls))
      }
      if (command === 'health_repair_receipts') return receipts
      if (command === 'health_repair_plan') {
        const request = args.request as { kind: string; path: string }
        const prune = request.kind === 'prune_asset', create = request.kind === 'create_note'
        const before = create || prune ? '' : '#Research\n', after = prune ? '' : create ? '# New\n' : '#research\n'
        return { vault_id: args.expectedVaultId, request, fingerprint: 'a'.repeat(64), changes: [{ path: request.path, expected_hash: create ? '<missing>' : 'b'.repeat(64), before, after, bytes: prune ? 42 : new TextEncoder().encode(after).byteLength }], ...(prune ? { scan: { complete: sessionStorage.getItem('e2e:incomplete-health-scan') !== '1', notes: 3, fingerprint: 'c'.repeat(64) } } : {}) }
      }
      if (command === 'health_repair_apply') {
        if (sessionStorage.getItem('e2e:stale-health-plan') === '1') throw new Error('Repair sources changed. Generate and review a new plan')
        const request = args.request as { path: string; kind: string }
        const receipt = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', vault_id: args.expectedVaultId, path: request.path, hash: 'b'.repeat(64), bytes: 42, kind: request.kind, after_hash: request.kind === 'prune_asset' ? '<missing>' : 'c'.repeat(64) }
        receipts.push(receipt); return receipt
      }
      if (command === 'health_repair_restore') return null
      return original(command, args, options)
    }
  })
  await openCommandPalette(page); await runCommand(page, 'Open vault health')
  const panel = page.getByRole('dialog', { name: 'Vault health', exact: true })
  await expect(panel.getByRole('heading', { name: 'Reviewed vault repairs' })).toBeVisible()
  return panel
}
async function calls(page: Page, command: string) {
  return page.evaluate(name => (JSON.parse(sessionStorage.getItem('e2e:health-calls') ?? '[]') as Array<{ command: string; args: Record<string, unknown> }>).filter(row => row.command === name), command)
}

test('default health evidence does not mistake an invalid recovery response for empty history', async ({ page }) => {
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open vault health')
  const panel = page.getByRole('dialog', { name: 'Vault health', exact: true })
  await panel.getByText('Recovery copies (0)', { exact: true }).click()
  await expect(panel.getByText('No repair recovery copies yet.', { exact: true })).toBeVisible()
  await expect(panel.getByRole('alert')).toHaveCount(0)
})

for (const theme of ['light', 'dark'] as const) {
  test(`repair paths retain readable themed controls and keyboard focus in ${theme} appearance`, async ({ page }, testInfo) => {
    const panel = await openRepairs(page, theme)
    const path = panel.getByLabel('Vault-relative note path', { exact: true })
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 900 })
      await page.locator('html').evaluate((element, direction) => { element.dir = direction }, width === 320 ? 'rtl' : 'ltr')
      await path.fill('Research/Reviewed repair.md')
      await path.focus()
      const control = await path.evaluate(element => {
        const style = getComputedStyle(element)
        const label = element.closest('label')!.getBoundingClientRect()
        const bounds = element.getBoundingClientRect()
        return {
          height: bounds.height, left: bounds.left, right: bounds.right,
          labelLeft: label.left, labelRight: label.right,
          radius: Number.parseFloat(style.borderRadius),
          background: style.backgroundColor, foreground: style.color,
          outline: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth),
          font: style.fontFamily, bodyFont: getComputedStyle(document.body).fontFamily,
        }
      })
      expect(control.height).toBeGreaterThanOrEqual(44)
      expect(control.radius).toBeGreaterThanOrEqual(4)
      expect(control.background).not.toMatch(/rgba\([^)]*,\s*0(?:\.0+)?\)$/)
      expect(control.foreground).not.toBe(control.background)
      expect(control.font).toBe(control.bodyFont)
      expect(control.outline).not.toBe('none')
      expect(control.outlineWidth).toBeGreaterThanOrEqual(2)
      expect(control.left).toBeGreaterThanOrEqual(control.labelLeft - 1)
      expect(control.right).toBeLessThanOrEqual(control.labelRight + 1)
      await panel.screenshot({ path: testInfo.outputPath(`repair-path-${theme}-${width}.png`), animations: 'disabled' })
    }
  })
}

test('repair and restore require explicit review and bind displayed source receipts', async ({ page }) => {
  const panel = await openRepairs(page)
  await panel.getByLabel('Vault-relative note path').fill('New.md')
  await panel.getByRole('button', { name: 'Review repair plan', exact: true }).click()
  const apply = panel.getByRole('button', { name: 'Apply reviewed repair', exact: true })
  await expect(apply).toBeDisabled()
  await panel.getByLabel('I reviewed this repair and its recovery consequences.').check()
  await apply.click()
  await expect(panel.getByRole('status')).toContainText('Repair applied')
  const applied = await calls(page, 'health_repair_apply')
  expect(applied).toHaveLength(1); expect(applied[0].args.expectedFingerprint).toBe('a'.repeat(64)); expect(applied[0].args.expectedVaultId).toBe('screenshot-vault')
  await panel.getByText('Recovery copies (1)', { exact: true }).click()
  await panel.getByRole('button', { name: 'Review restoration', exact: true }).click()
  const restore = panel.getByRole('button', { name: 'Restore reviewed content', exact: true })
  await expect(restore).toBeDisabled()
  await panel.getByLabel('I reviewed this restoration.').check(); await restore.click()
  await expect(panel.getByRole('status')).toContainText('Original content restored')
  const restored = await calls(page, 'health_repair_restore')
  expect(restored).toHaveLength(1); expect(restored[0].args.expectedReceipt).toMatchObject({ path: 'New.md', vault_id: 'screenshot-vault', hash: 'b'.repeat(64) })
})

test('cancelled review performs no mutation and source drift keeps the reviewed plan visible', async ({ page }) => {
  const panel = await openRepairs(page)
  await panel.getByRole('button', { name: 'Normalize tag case', exact: true }).click()
  await panel.getByLabel('Vault-relative note path').fill('Research Plan.md')
  await panel.getByRole('button', { name: 'Review repair plan', exact: true }).click()
  await panel.getByRole('button', { name: 'Cancel plan', exact: true }).click()
  expect(await calls(page, 'health_repair_apply')).toHaveLength(0)
  await panel.getByRole('button', { name: 'Review repair plan', exact: true }).click()
  await panel.getByLabel('I reviewed this repair and its recovery consequences.').check()
  await page.evaluate(() => sessionStorage.setItem('e2e:stale-health-plan', '1'))
  await panel.getByRole('button', { name: 'Apply reviewed repair', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Repair sources changed')
  await expect(panel.getByRole('region', { name: 'Repair plan', exact: true })).toBeVisible()
  await expect(panel.getByText('Recovery copies (0)', { exact: true })).toBeVisible()
})

test('an incomplete asset reference scan blocks pruning before confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const panel = await openRepairs(page)
  await panel.getByRole('button', { name: 'Recoverably prune asset', exact: true }).click()
  await panel.getByLabel('Vault-relative asset path').fill('assets/image.png')
  await page.evaluate(() => sessionStorage.setItem('e2e:incomplete-health-scan', '1'))
  await panel.getByRole('button', { name: 'Review repair plan', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('complete reference scan')
  await expect(panel.getByRole('button', { name: 'Apply reviewed repair', exact: true })).toHaveCount(0)
  expect(await calls(page, 'health_repair_apply')).toHaveLength(0)
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
