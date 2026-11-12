import { expect, test, type Locator, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

/**
 * Supplemental, provider-safe visual acceptance: no live accounts and no real
 * sync writes. These are Scriptor UI captures backed by existing E2E harnesses.
 * No success state is captured before its corresponding assertion passes.
 */
async function capture(page: Page, name: string, focus: Locator) {
  await expect(focus).toBeVisible()
  await focus.scrollIntoViewIfNeeded()
  // Nested scrollports can clip a subpixel of the focused element on Windows Edge.
  // Require at least 99% visibility instead of an unattainable perfect ratio.
  await expect(focus).toBeInViewport({ ratio: 0.99 })
  await settleLayout(page)
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: test.info().outputPath(name),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  })
}

async function openResearch(page: Page, command: string) {
  await page.addInitScript(() => sessionStorage.setItem('e2e:research', '1'))
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await openCommandPalette(page)
  await runCommand(page, command)
}

test('Zotero access, paginated reference preview and account-switch cache clearing', async ({ page }) => {
  await openResearch(page, 'Browse bibliography')
  const bibliography = page.getByRole('dialog', { name: 'Bibliography', exact: true })
  await bibliography.getByRole('button', { name: 'Review Zotero import', exact: true }).click()
  const apiKey = bibliography.getByLabel('Zotero read API key', { exact: true })
  await expect(apiKey).toBeVisible()
  await capture(page, 'visual-integration-zotero-read-only-setup.png', apiKey)

  // Only an invented fixture token is entered. No live credential is sent.
  await apiKey.fill('fixtureReadOnlyKey')
  await bibliography.getByRole('button', { name: 'Fetch preview', exact: true }).click()
  const first = bibliography.getByText('A previewed research paper', { exact: true })
  await expect(first).toBeVisible()
  await capture(page, 'visual-integration-zotero-first-preview.png', first)
  await bibliography.getByRole('button', { name: 'Fetch next page', exact: true }).click()
  const second = bibliography.getByText('Second-page paper', { exact: true })
  await expect(second).toBeVisible()
  await expect(bibliography.getByText(/Current vault bibliography: 1 entry/)).toBeVisible()
  await expect(bibliography.getByText(/Zotero import preview: 2 references/)).toBeVisible()
  await expect(bibliography.locator('.reference-import-review')).toHaveClass(/has-scroll-cue/)
  await capture(page, 'visual-integration-zotero-paginated-preview.png', second)

  await apiKey.fill('differentFixtureKey')
  await expect(bibliography.getByRole('button', { name: 'Fetch next page', exact: true })).toHaveCount(0)
  await expect(bibliography.getByRole('button', { name: 'Save selected references as a new bibliography', exact: true })).toHaveCount(0)
  await capture(page, 'visual-integration-zotero-account-changed.png', apiKey)
  const writes = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:research-calls') ?? '[]') as Array<{cmd: string}>)
    .filter(item => item.cmd === 'vault_save_asset'))
  expect(writes).toHaveLength(0)
})

test('Web capture review presents safe source, editable metadata and confirmed save', async ({ page }) => {
  await openResearch(page, 'Capture reviewer')
  const panel = page.getByRole('region', { name: 'Capture reviewer', exact: true })
  const url = panel.getByLabel('Article URL', { exact: true })
  await url.fill('https://example.org/article')
  const extract = panel.getByRole('button', { name: 'Extract preview', exact: true })
  await capture(page, 'visual-integration-capture-before-extract.png', extract)
  await extract.click()
  const markdown = panel.getByRole('textbox', { name: 'Reviewed Markdown', exact: true })
  await expect(markdown).toHaveValue(/useful research/)
  const original = page.frameLocator('iframe[title="Original source snapshot"]')
  await expect(original.getByRole('heading', { name: 'Original research finding', exact: true })).toBeVisible()
  await expect(original.locator('script, img, form, input, a, link')).toHaveCount(0)
  await panel.getByLabel('Author', { exact: true }).fill('Example Researcher')
  await capture(page, 'visual-integration-capture-reviewed-source.png', markdown)

  await panel.getByRole('button', { name: 'Save reviewed capture as a new note', exact: true }).click()
  const status = panel.getByRole('status')
  await expect(status).toContainText('Saved and indexed reviewed capture')
  await capture(page, 'visual-integration-capture-saved-receipt.png', status)
})

test('Web capture extraction failure stays visible and retryable without a write', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('e2e:capture-failure', '1'))
  await openResearch(page, 'Capture reviewer')
  const panel = page.getByRole('region', { name: 'Capture reviewer', exact: true })
  await panel.getByLabel('Article URL', { exact: true }).fill('https://example.org/article')
  const extract = panel.getByRole('button', { name: 'Extract preview', exact: true })
  await extract.click()
  const error = panel.getByRole('alert')
  await expect(error).toContainText('Article extraction unavailable')
  await expect(panel.locator('.capture-extraction-alert')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Retry extraction' })).toBeEnabled()
  await expect(extract).toBeEnabled()
  await capture(page, 'visual-integration-capture-extraction-recovery.png', error)
  const writes = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:research-calls') ?? '[]') as Array<{cmd: string}>)
    .filter(item => item.cmd === 'vault_save_asset'))
  expect(writes).toHaveLength(0)
})

test('Git pull and push are disabled during conflict until a reviewed merge is selected', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('e2e:git-conflicts', '1'))
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open Git panel')
  const git = page.locator('.git-panel')
  await expect(git).toBeVisible()
  const banner = git.getByRole('alert')
  await expect(banner).toContainText('1 merge conflict(s)')
  await expect(git.getByRole('button', { name: 'Pull', exact: true })).toBeDisabled()
  await expect(git.getByRole('button', { name: 'Push', exact: true })).toBeDisabled()
  await capture(page, 'visual-integration-git-sync-conflict.png', banner)

  await git.getByRole('button', { name: 'Resolve', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Resolve merge conflicts', exact: true })
  const choice = dialog.getByRole('radio', { name: 'Keep incoming changes', exact: true })
  await expect(choice).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apply selected changes', exact: true })).toBeDisabled()
  await choice.check()
  const merged = dialog.locator('.conflict-merged-body')
  await expect(merged).toContainText('Updated field observations after second pass.')
  await expect(merged).not.toContainText('<<<<<<<')
  await expect(dialog.getByRole('button', { name: 'Apply selected changes', exact: true })).toBeEnabled()
  await capture(page, 'visual-integration-git-reviewed-resolution.png', merged)
  expect(await page.evaluate(() => window.__scriptorE2eMergedConflict ?? null)).toBeNull()
})

test('Backup verification, restore confirmation and native rollback receipt', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & {
      __TAURI_INTERNALS__?: {
        invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown>
      }
    }
    const bridge = host.__TAURI_INTERNALS__
    if (!bridge?.invoke) throw new Error('Native fixture bridge unavailable')
    const invoke = bridge.invoke.bind(bridge)
    bridge.invoke = async (command, args, options) => {
      if (command === 'vault_list_backups') {
        return [
          {
            name: 'vault-backup-corrupt',
            path: 'vault-backup-corrupt',
            created_at: '2026-10-27T00:00:00Z',
            size_bytes: 512,
            storage_kind: 'external_backup',
            verified: false,
          },
          {
            name: 'vault-backup-valid',
            path: 'vault-backup-valid',
            created_at: '2026-10-27T00:00:00Z',
            size_bytes: 512,
            storage_kind: 'external_backup',
            verified: true,
          },
        ]
      }
      if (command === 'vault_restore_backup') {
        if (args?.backupName !== 'vault-backup-valid' || args?.backupPath !== 'C:/EvidenceFixture') {
          throw new Error('Refusing an unverified or cross-folder fixture restore')
        }
        return { status: 'rolled-back', message: 'Restore was safely rolled back by the native service.' }
      }
      return invoke(command, args, options)
    }
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/EvidenceFixture')
  const invalid = backup.locator('.backup-entry').filter({ hasText: 'vault-backup-corrupt' })
  const valid = backup.locator('.backup-entry').filter({ hasText: 'vault-backup-valid' })
  await expect(invalid).toContainText('This backup could not be verified')
  await expect(invalid.getByRole('button', { name: 'Restore backup vault-backup-corrupt' })).toBeDisabled()
  await expect(valid.getByRole('button', { name: 'Restore backup vault-backup-valid' })).toBeEnabled()
  await capture(page, 'visual-integration-backup-unverified-protection.png', invalid)

  await valid.getByRole('button', { name: 'Restore backup vault-backup-valid' }).click()
  const confirm = backup.getByRole('button', { name: 'Restore backup', exact: true })
  await expect(confirm).toBeVisible()
  await capture(page, 'visual-integration-backup-restore-confirmation.png', confirm)
  await confirm.click()
  const receipt = backup.getByRole('region', { name: 'Last restore attempt (this session)' })
  await expect(receipt.getByRole('status')).toContainText('Restore rolled back')
  await expect(receipt).toContainText('original vault files are unchanged')
  await expect(receipt).not.toContainText('Files restored')
  await expect(receipt).toContainText('Restore not applied')
  await expect(receipt.getByRole('button', { name: 'Review backups' })).toBeVisible()
  await capture(page, 'visual-integration-backup-rollback-receipt.png', receipt.getByRole('status'))
})

test('Read-only Google Calendar permits reviewed inbound changes but not remote writes', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:google-ecosystem', '1')
    sessionStorage.setItem('e2e:research', '0')
  })
  await launchApp(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByRole('tab', { name: 'Integrations', exact: true }).click()
  const group = settings.locator('.google-integration-settings').getByRole('group', { name: 'Google Calendar & Tasks', exact: true })
  await group.locator('details.google-calendar-options > summary').click()
  const calendar = group.getByRole('combobox', { name: 'Calendar', exact: true })
  await expect(calendar.locator('option', { hasText: 'Shared read-only calendar' })).toBeAttached()
  await calendar.selectOption('reader@example.com')
  await settings.getByRole('button', { name: 'Save vault settings', exact: true }).click()
  await page.reload()
  await openCommandPalette(page)
  await runCommand(page, 'Open tasks panel')
  const planner = page.getByRole('region', { name: 'Weekly planner', exact: true })
  const vaultTask = planner.getByRole('combobox', { name: 'Vault task', exact: true })
  await vaultTask.selectOption({ label: 'Collect sources' })
  await planner.getByRole('combobox', { name: 'Google event', exact: true }).selectOption('remote-event')
  await planner.getByRole('button', { name: 'Save time block', exact: true }).click()
  await planner.getByRole('button', { name: 'Review changes before syncing', exact: true }).click()
  const row = planner.locator('.planner-review__row').filter({
    has: page.locator('pre', { hasText: 'remote-event' }),
  })
  await expect(row).toHaveCount(1)
  const outbound = row.getByRole('button', { name: 'Use vault → Google', exact: true })
  const inbound = row.getByRole('button', { name: 'Use Google → vault', exact: true })
  await expect(outbound).toBeDisabled()
  await expect(inbound).toBeEnabled()
  await expect(row.locator('details > summary')).toHaveText('Technical details')
  await expect(row.locator('pre')).toBeHidden()
  await expect(row).toContainText('Read-only calendar')
  await expect(row.locator('.planner-review__summary')).toBeVisible()
  await expect(row.locator('.planner-review__row-index')).toContainText(/Change \d+ of \d+/)
  await capture(page, 'visual-integration-calendar-readonly-sync-review.png', inbound)
  await inbound.click()
  const status = planner.getByRole('status').filter({ hasText: 'Change applied' })
  await expect(status).toBeVisible()
  await expect(status).toContainText('Google → vault')
  await expect(status).toContainText('Collect sources')
  await capture(page, 'visual-integration-calendar-inbound-sync-applied.png', status)
  const remoteWrites = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:google-ecosystem-calls') ?? '[]') as Array<{cmd: string}>)
    .filter(item => item.cmd === 'google_planner_write_event'))
  expect(remoteWrites).toHaveLength(0)
})
