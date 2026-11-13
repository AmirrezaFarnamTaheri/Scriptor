import { expect, test, type Locator, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

/**
 * Named screenshots of Scriptor's provider journeys. All account identities,
 * mail, projects, filesystem paths and authorization responses are supplied
 * by the opt-in browser E2E fixtures: these never contact live providers.
 * Keep each screenshot coupled to an observable state assertion.
 */
async function captureProvider(page: Page, filename: string, focus: Locator) {
  await expect(focus).toBeVisible()
  await focus.scrollIntoViewIfNeeded()
  // Nested scrollports can clip a subpixel of the focused element on Windows Edge.
  // Require at least 99% visibility instead of an unattainable perfect ratio.
  await expect(focus).toBeInViewport({ ratio: 0.99 })
  await settleLayout(page)
  await expect(page.locator('.editor-loading-state')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: test.info().outputPath(filename),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  })
}

async function openGmail(page: Page, connected: boolean) {
  await page.addInitScript((initiallyConnected: boolean) => {
    sessionStorage.setItem('e2e:google-gmail', '1')
    sessionStorage.setItem('e2e:enable-gmail-plugin', '1')
    sessionStorage.setItem('e2e:gmail-connected', initiallyConnected ? '1' : '0')
    localStorage.setItem('scriptor:plugins:consent', JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-11-12T00:00:00Z',
      data: {
        'scriptor.gmail-manager': {
          grantedPermissions: ['read', 'write-approved'],
          allowedVaultIds: ['screenshot-vault'],
          networkAccess: 'blocked',
          allowlistedHosts: [],
          reviewedAt: '2026-11-12T00:00:00Z',
        },
      },
    }))
  }, connected)
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await openCommandPalette(page)
  await runCommand(page, 'Open Gmail Manager')
  const panel = page.locator('.gmail-manager-panel')
  await expect(panel).toBeVisible()
  return panel
}

async function openGoogleSettings(page: Page) {
  await page.locator('header.topbar').getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(settings).toBeVisible()
  await settings.getByRole('tab', { name: 'Integrations', exact: true }).click()
  const google = settings.locator('.google-integration-settings')
  await expect(google).toBeVisible()
  return { settings, google }
}

test('Gmail sign-in, connected inbox, message, draft and failed-send evidence', async ({ page }) => {
  const panel = await openGmail(page, false)
  const connect = panel.getByRole('button', { name: 'Connect with Google', exact: true })
  await expect(connect).toBeEnabled()
  await expect(panel).toContainText('Gmail is not connected')
  await captureProvider(page, 'visual-provider-gmail-sign-in.png', connect)

  await connect.click()
  await expect(panel.locator('.gmail-manager-message-row')).toHaveCount(2)
  const firstMessage = panel.locator('.gmail-manager-message-row').first()
  await expect(firstMessage).toContainText('Research meeting')
  await expect(panel.locator('.gmail-manager-maturity')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Integration limitations' })).toBeVisible()
  await captureProvider(page, 'visual-provider-gmail-inbox-connected.png', firstMessage)

  await firstMessage.click()
  const messageBody = panel.locator('.gmail-manager-message-body')
  await expect(messageBody).toContainText('Plain message text.')
  await expect(messageBody.locator('script, img')).toHaveCount(0)
  await expect(panel.getByText('Shown as plain text; remote content was not loaded.')).toBeVisible()
  await captureProvider(page, 'visual-provider-gmail-message-detail.png', messageBody)
  await panel.getByRole('tab', { name: 'Account', exact: true }).click()
  await expect(panel.locator('.gmail-manager-maturity')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Integration limitations' })).toHaveCount(0)
  await panel.getByRole('tab', { name: 'Messages', exact: true }).click()

  await panel.getByRole('tab', { name: 'Compose', exact: true }).click()
  await panel.getByLabel('Recipient (To)').fill('recipient@example.com')
  await panel.getByLabel('Subject', { exact: true }).fill('Evidence review: retained draft')
  const draft = panel.getByLabel('Message body (plain text)')
  await draft.fill('Please review the evidence before sending.\nNo live messages are transmitted in this fixture.')
  const send = panel.getByRole('button', { name: 'Send message', exact: true })
  await expect(send).toBeEnabled()
  await captureProvider(page, 'visual-provider-gmail-compose-review.png', draft)

  await page.evaluate(() => sessionStorage.setItem('e2e:gmail-cancel-approval', '1'))
  await send.click()
  const alert = panel.getByRole('alert')
  await expect(alert).toContainText('cancelled')
  await expect(draft).toHaveValue(/No live messages are transmitted/)
  await captureProvider(page, 'visual-provider-gmail-authorization-cancelled.png', alert)

  await page.evaluate(() => {
    sessionStorage.removeItem('e2e:gmail-cancel-approval')
    sessionStorage.setItem('e2e:gmail-send-error', '1')
  })
  await send.click()
  await expect(alert).toContainText('Gmail send failed')
  await expect(alert).toContainText('Delivery uncertain')
  await expect(alert.getByText(/Check Gmail Sent before another send/i)).toHaveCount(1)
  await expect(panel.getByLabel('Subject', { exact: true })).toHaveValue('Evidence review: retained draft')
  await expect(draft).toHaveValue(/No live messages are transmitted/)
  await captureProvider(page, 'visual-provider-gmail-send-failed-draft.png', alert)
  await page.setViewportSize({ width: 390, height: 844 })
  await captureProvider(page, 'visual-provider-gmail-send-failed-390.png', alert)
})

test('Google account entry, distinct permissions and Calendar sync choices', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:google-ecosystem', '1')
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:google-drive-connected', '0')
    sessionStorage.setItem('e2e:google-calendar-connected', '0')
  })
  await launchApp(page)
  const { google } = await openGoogleSettings(page)
  await expect(google.getByText('Account authorization', { exact: true })).toBeVisible()
  await expect(google.getByText(/Vault configuration changes are saved separately/)).toBeVisible()
  const drive = google.getByRole('group', { name: 'Google Drive & Docs', exact: true })
  const calendar = google.getByRole('group', { name: 'Google Calendar & Tasks', exact: true })
  const connectDrive = drive.getByRole('button', { name: 'Connect Google · Google Drive & Docs', exact: true })
  const connectCalendar = calendar.getByRole('button', { name: /^(Connect Google|Reconnect) · Google Calendar & Tasks$/ })
  await expect(connectDrive).toBeEnabled()
  await expect(connectCalendar).toBeEnabled()
  await captureProvider(page, 'visual-provider-google-connect-drive.png', connectDrive)
  // Capture Calendar sign-in with its advanced sync settings expanded; otherwise
  // two snapshots of the untouched settings dialog are byte-identical.
  await calendar.locator('details.google-calendar-options > summary').click()
  await captureProvider(page, 'visual-provider-google-connect-calendar.png', connectCalendar)
  await calendar.locator('details.google-calendar-options > summary').click()

  await connectDrive.click()
  await expect(drive.getByRole('status')).toContainText('drive@example.com')
  await captureProvider(page, 'visual-provider-google-drive-connected.png', drive.getByRole('status'))
  await connectCalendar.click()
  await expect(calendar.getByRole('status')).toContainText('calendar@example.com')
  await captureProvider(page, 'visual-provider-google-calendar-connected.png', calendar.getByRole('status'))

  await calendar.locator('details.google-calendar-options > summary').click()
  const calendarChoice = calendar.getByRole('combobox', { name: 'Calendar', exact: true })
  const taskChoice = calendar.getByRole('combobox', { name: 'Task list', exact: true })
  await expect(calendarChoice.locator('option', { hasText: 'Shared read-only calendar' })).toBeAttached()
  await calendarChoice.selectOption('reader@example.com')
  await taskChoice.selectOption('research-tasks')
  await expect(taskChoice).toHaveValue('research-tasks')
  await captureProvider(page, 'visual-provider-google-calendar-sync-choices.png', taskChoice)
})

test('Expired Google authorization has separate actionable Drive and Calendar recovery', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:google-ecosystem', '1')
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:google-drive-auth-expired', '1')
    sessionStorage.setItem('e2e:google-calendar-auth-expired', '1')
  })
  await launchApp(page)
  const { google } = await openGoogleSettings(page)
  const drive = google.getByRole('group', { name: 'Google Drive & Docs', exact: true })
  const calendar = google.getByRole('group', { name: 'Google Calendar & Tasks', exact: true })
  await expect(drive.getByRole('alert')).toContainText('Google authorization expired')
  await expect(calendar.getByRole('alert')).toContainText('Google authorization expired')
  const driveReconnect = drive.getByRole('button', { name: 'Reconnect · Google Drive & Docs', exact: true })
  const calendarReconnect = calendar.getByRole('button', { name: 'Reconnect · Google Calendar & Tasks', exact: true })
  await expect(driveReconnect).toBeEnabled()
  await expect(calendarReconnect).toBeEnabled()
  await captureProvider(page, 'visual-provider-google-drive-expired.png', driveReconnect)
  await calendar.locator('details.google-calendar-options > summary').click()
  await captureProvider(page, 'visual-provider-google-calendar-expired.png', calendarReconnect)

  // A cancelled authorization must retain the recovery action. No provider
  // call or write is performed by these browser-only fixtures.
  await page.evaluate(() => sessionStorage.setItem('e2e:google-cancel-operation', 'google_calendar_auth'))
  await calendarReconnect.click()
  await expect(calendar.getByRole('alert')).toContainText('Authorization cancelled')
  await captureProvider(page, 'visual-provider-google-calendar-auth-cancelled.png', calendar.getByRole('alert'))
})

test('Drive discovery and Docs preview are visible before any write approval', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:google-ecosystem', '1')
    sessionStorage.setItem('e2e:research', '1')
  })
  await launchApp(page)
  await openCommandPalette(page)
  await runCommand(page, 'Drive collaboration')
  const drive = page.getByRole('region', { name: 'Drive collaboration', exact: true })
  await expect(drive).toBeVisible()
  await expect(drive.getByLabel('Shared folder ID', { exact: true })).toHaveValue('shared-folder')
  await drive.getByRole('button', { name: 'Browse accessible folders', exact: true }).click()
  const folder = drive.getByRole('combobox', { name: 'Choose a Drive folder', exact: true })
  await expect(folder).toBeVisible()
  await captureProvider(page, 'visual-provider-drive-folder-discovery.png', folder)

  await drive.getByText('Google Docs text copies', { exact: true }).click()
  await drive.getByRole('button', { name: 'Browse documents in this folder', exact: true }).click()
  const docs = drive.getByRole('combobox', { name: 'Choose a Google document', exact: true })
  await docs.selectOption('shared-doc')
  await drive.getByRole('button', { name: 'Preview text from Google Docs', exact: true }).click()
  const preview = drive.getByRole('textbox', { name: 'Review imported text', exact: true })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveValue(/Remote translated text/)
  await expect(drive.getByRole('alert')).toContainText('Possible unresolved merge markers')
  await captureProvider(page, 'visual-provider-drive-docs-import-review.png', preview)
  await page.setViewportSize({ width: 390, height: 844 })
  await captureProvider(page, 'visual-provider-drive-docs-conflict-390.png', drive.getByRole('alert'))
  // Coverage gap: conflict-free text is not equivalent to approved import.
  // Capture the reviewed consent state without submitting a local note write.
  await page.setViewportSize({ width: 1440, height: 900 })
  await preview.fill('# Conflict-free reviewed translation\n\nLocal and remote material has been compared.')
  await expect(drive.getByRole('alert')).toHaveCount(0)
  const docsSave = drive.getByRole('button', { name: 'Save reviewed text', exact: true })
  await expect(docsSave).toBeDisabled()
  const lossConsent = drive.getByRole('checkbox', { name: /I understand that comments, formatting, history, images and sharing permissions do not transfer/ })
  await lossConsent.check()
  await expect(docsSave).toBeEnabled()
  await captureProvider(page, 'visual-provider-drive-docs-reviewed-consent.png', docsSave)
  const writes = await page.evaluate(() =>
    (JSON.parse(sessionStorage.getItem('e2e:google-ecosystem-calls') ?? '[]') as Array<{ cmd: string }>)
      .filter(call => call.cmd === 'vault_save_note' || call.cmd === 'collaboration_write'),
  )
  expect(writes.filter(call => call.cmd === 'vault_save_note')).toHaveLength(0)
})

async function openOverleafReview(page: Page) {
  await launchApp(page)
  await page.evaluate(() => {
    const bridge = (window as Window & {
      __TAURI_INTERNALS__?: {
        invoke?: (command: string, payload?: Record<string, unknown>, options?: unknown) => Promise<unknown>
      }
    }).__TAURI_INTERNALS__
    if (!bridge?.invoke) throw new Error('Browser-only native source fixture is unavailable')
    const original = bridge.invoke.bind(bridge)
    let content = '\\section{Local}\r\n'
    let hash = 'a'.repeat(64)
    bridge.invoke = async (command, payload = {}, options) => {
      if (command.startsWith('source_file_')) {
        if (command === 'source_file_save') {
          if (payload.expectedContentHash !== hash) throw new Error('Local source changed since review')
          content = String(payload.content)
          hash = 'b'.repeat(64)
        }
        return {
          vault_id: payload.expectedVaultId,
          path: payload.path,
          content,
          content_hash: hash,
          language: 'latex',
        }
      }
      if (command === 'overleaf_read') {
        return { head: 'c'.repeat(40), content: '\\section{Remote}\r\n', content_hash: 'd'.repeat(64) }
      }
      if (command === 'overleaf_push') {
        if (sessionStorage.getItem('e2e:overleaf-stale') === '1') {
          throw new Error('Overleaf changed since review. Fetch a new preview before sharing; no files were pushed.')
        }
        return { head: 'e'.repeat(40), content: payload.content, content_hash: 'f'.repeat(64) }
      }
      return original(command, payload, options)
    }
  })
  await openCommandPalette(page)
  await runCommand(page, 'Source file editor')
  const source = page.getByRole('region', { name: 'Source file editor', exact: true })
  await source.getByRole('button', { name: 'Plain text', exact: true }).click()
  await source.getByLabel('File path', { exact: true }).fill('main.tex')
  await source.getByRole('button', { name: 'Open file', exact: true }).click()
  await source.getByRole('button', { name: 'Open Overleaf sync', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Overleaf source sync', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Overleaf project ID or official URL', { exact: true }).fill('fixture-project-123')
  return dialog
}

test('Overleaf connection requirements, remote comparison, consent and conflict evidence', async ({ page }) => {
  const dialog = await openOverleafReview(page)
  const fetch = dialog.getByRole('button', { name: 'Fetch remote source preview', exact: true })
  await expect(fetch).toBeEnabled()
  await captureProvider(page, 'visual-provider-overleaf-connection.png', fetch)
  await fetch.click()
  const reviewed = dialog.getByLabel('Reviewed source to apply locally or share', { exact: true })
  await expect(reviewed).toHaveValue('\\section{Remote}\n')
  await expect(dialog.getByRole('region', { name: 'Reviewed remote source', exact: true })).toContainText('Remote')
  await expect(dialog.locator('.overleaf-diff-line.is-changed')).not.toHaveCount(0)
  await expect(dialog.locator('.overleaf-action-footer')).toBeVisible()
  await captureProvider(page, 'visual-provider-overleaf-comparison.png', reviewed)

  await reviewed.fill('\\section{Reviewed merged source}\n')
  const consent = dialog.getByLabel('I compared both copies and reviewed this source for the selected action')
  const share = dialog.getByRole('button', { name: 'Share reviewed source with Overleaf', exact: true })
  await expect(share).toBeDisabled()
  await consent.check()
  await expect(share).toBeEnabled()
  await captureProvider(page, 'visual-provider-overleaf-approved-review.png', consent)

  await share.click()
  await expect(dialog.getByRole('status')).toContainText('Reviewed source shared with Overleaf')
  await captureProvider(page, 'visual-provider-overleaf-share-result.png', dialog.getByRole('status'))

  await consent.check()
  await page.evaluate(() => sessionStorage.setItem('e2e:overleaf-stale', '1'))
  await share.click()
  const alert = dialog.getByRole('alert')
  await expect(alert).toContainText('Overleaf changed since review')
  await expect(alert).toContainText('Latest share was not pushed')
  await expect(dialog.getByRole('button', { name: 'Fetch latest remote preview' })).toBeEnabled()
  await expect(dialog.getByText('Previous successful share')).toBeVisible()
  // A stale remote revision invalidates consent; sharing must be impossible
  // until a fresh remote preview is fetched and reviewed.
  await expect(dialog.getByRole('status')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Share reviewed source with Overleaf' })).toHaveCount(0)
  await captureProvider(page, 'visual-provider-overleaf-stale-revision.png', alert)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { document.documentElement.dir = 'rtl' })
  // At compact RTL widths the Close action belongs beside the heading,
  // not in a full-width second row that pushes recovery below the fold.
  const headerTitle = dialog.locator(':scope > header h2')
  const headerClose = dialog.getByRole('button', { name: 'Close Overleaf sync' })
  const titleBox = await headerTitle.boundingBox()
  const closeBox = await headerClose.boundingBox()
  expect(titleBox).not.toBeNull()
  expect(closeBox).not.toBeNull()
  expect(closeBox!.width).toBeLessThanOrEqual(48)
  expect(Math.abs((titleBox!.y + titleBox!.height / 2) - (closeBox!.y + closeBox!.height / 2))).toBeLessThanOrEqual(25)
  await captureProvider(page, 'visual-provider-overleaf-stale-rtl-390.png', alert)
  // Coverage gap: record the safe recovery from a rejected CAS share, not
  // only its failure. A fresh preview must invalidate all prior consent.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => { document.documentElement.dir = 'ltr'; sessionStorage.removeItem('e2e:overleaf-stale') })
  await dialog.getByRole('button', { name: 'Fetch latest remote preview' }).click()
  const freshReview = dialog.getByLabel('Reviewed source to apply locally or share', { exact: true })
  await expect(freshReview).toHaveValue('\\section{Remote}\n')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  const freshShare = dialog.getByRole('button', { name: 'Share reviewed source with Overleaf', exact: true })
  await expect(freshShare).toBeDisabled()
  await captureProvider(page, 'visual-provider-overleaf-fresh-review-required.png', freshReview)
  await freshReview.fill('\\section{Reviewed recovery after remote change}\n')
  await dialog.getByLabel('I compared both copies and reviewed this source for the selected action').check()
  await freshShare.click()
  const recovered = dialog.getByRole('status')
  await expect(recovered).toContainText('Reviewed source shared with Overleaf')
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await captureProvider(page, 'visual-provider-overleaf-recovered-share-confirmed.png', recovered)
})

test('Resource sync requires a reviewed plan and visibly reports partial completion', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await page.evaluate(() => {
    const bridge = (window as Window & {
      __TAURI_INTERNALS__?: {
        invoke?: (command: string, payload?: Record<string, unknown>, options?: unknown) => Promise<unknown>
      }
    }).__TAURI_INTERNALS__
    if (!bridge?.invoke) throw new Error('Browser-only resource sync fixture is unavailable')
    const original = bridge.invoke.bind(bridge)
    const resource = {
      id: 'e2e-research-skill',
      logicalId: 'skill:research-lens',
      name: 'research-lens',
      kind: 'skill',
      targetId: 'codex',
      scope: 'user',
      path: 'C:/Users/fixture/.codex/skills/research-lens',
      manifestPath: 'C:/Users/fixture/.codex/skills/research-lens/SKILL.md',
      contentHash: '0123456789abcdef0123456789abcdef',
      managed: true,
      symlinked: false,
      valid: true,
      issues: [],
    }
    const target = (id: string, label: string) => ({
      id, label, kind: 'cli', supportLevel: 'native', status: 'confirmed',
      evidence: [{ kind: 'config_root', path: 'C:/Users/fixture/.' + id + '/skills', exists: true, resourceCount: 1 }],
      installations: [{ id: id + '-fixture', identityKind: 'executable', path: 'C:/Tools/' + id + '.exe', version: '1.0-fixture', sha256: 'fixture-hash' }],
      resourceRoots: ['C:/Users/fixture/.' + id + '/skills'],
    })
    const inventory = {
      generatedAtMs: 1786200000000,
      fingerprint: 'fixture-resource-fingerprint',
      targets: [target('codex', 'Codex CLI'), target('cursor', 'Cursor')],
      resources: [resource],
      duplicates: [],
    }
    const operations = [
      {
        id: 'sync-noop',
        kind: 'noop',
        targetId: 'cursor',
        sourcePath: resource.path,
        destinationPath: 'C:/Users/fixture/.cursor/skills/research-lens/README.md',
        expectedSourceHash: resource.contentHash,
        expectedDestinationHash: resource.contentHash,
        summary: 'Keep existing reviewed metadata',
      },
      {
        id: 'sync-install',
        kind: 'install',
        targetId: 'cursor',
        sourcePath: resource.path,
        destinationPath: 'C:/Users/fixture/.cursor/skills/research-lens/SKILL.md',
        expectedSourceHash: resource.contentHash,
        expectedDestinationHash: null,
        summary: 'Install reviewed research-lens skill in Cursor',
      },
    ]
    bridge.invoke = async (command, payload = {}, options) => {
      if (command === 'resource_inventory') return inventory
      if (command === 'resource_create_plan') {
        const request = payload.request as { sourceInstanceId: string; targetIds: string[] }
        if (request.sourceInstanceId !== resource.id || !request.targetIds.includes('cursor')) {
          throw new Error('Unexpected source or destination in fixture sync plan')
        }
        return {
          id: 'fixture-resource-sync-plan',
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 15 * 60_000,
          inventoryFingerprint: inventory.fingerprint,
          sourceInstanceId: resource.id,
          operations,
          warnings: ['No changes are applied before explicit review and approval.'],
          planFingerprint: 'fixture-reviewed-fingerprint',
        }
      }
      if (command === 'authorize_sensitive_operation' && payload.operation === 'resource_sync') {
        if (payload.scope !== 'fixture-resource-sync-plan') throw new Error('Unexpected resource approval scope')
        return { token: 'fixture-approval-only', operation: 'resource_sync', scope: payload.scope, expiresAtMs: Date.now() + 60_000 }
      }
      if (command === 'resource_apply_plan') {
        if (payload.planId !== 'fixture-resource-sync-plan' || payload.authorizationToken !== 'fixture-approval-only') {
          throw new Error('Unreviewed or unauthorized fixture plan')
        }
        // The initial partial result, a later hard failure and a fully
        // confirmed completion are independent test states with distinct UI.
        const fixtureOutcome = sessionStorage.getItem('e2e:resource-apply-outcome')
        if (fixtureOutcome === 'failed') return {
          planId: 'fixture-resource-sync-plan',
          status: 'failed',
          receipts: [],
          failures: [{ operationId: 'sync-install', targetId: 'cursor', category: 'source_changed',
            message: 'No destination was updated; inspect the changed source before another review.' }],
        }
        if (fixtureOutcome === 'completed') return {
          planId: 'fixture-resource-sync-plan',
          status: 'completed',
          receipts: [
            { operationId: 'sync-noop', targetId: 'cursor', outcome: 'unchanged',
              destinationPath: operations[0].destinationPath, contentHash: resource.contentHash, quarantinePath: null },
            { operationId: 'sync-install', targetId: 'cursor', outcome: 'installed',
              destinationPath: operations[1].destinationPath, contentHash: resource.contentHash, quarantinePath: null },
          ],
          failures: [],
        }
        return {
          planId: 'fixture-resource-sync-plan',
          status: 'partial',
          receipts: [{
            operationId: 'sync-noop',
            targetId: 'cursor',
            outcome: 'unchanged',
            destinationPath: operations[0].destinationPath,
            contentHash: resource.contentHash,
            quarantinePath: null,
          }],
          failures: [{
            operationId: 'sync-install',
            targetId: 'cursor',
            category: 'source_changed',
            message: 'Destination changed since preview; review again before syncing.',
          }],
        }
      }
      return original(command, payload, options)
    }
  })

  await openCommandPalette(page)
  await runCommand(page, 'Open MCP panel')
  const mcp = page.locator('.mcp-panel')
  await expect(mcp).toBeVisible()
  await mcp.getByRole('tab', { name: 'Sharing & sync' }).click()
  const sharing = mcp.getByRole('region', { name: 'Sharing and sync' })
  await expect(sharing).toContainText('research-lens')
  const cursor = sharing.getByRole('checkbox', { name: 'Sync Cursor', exact: true })
  await cursor.check()
  await expect(cursor).toBeChecked()
  await captureProvider(page, 'visual-provider-resource-sync-destinations.png', cursor)

  await sharing.getByRole('button', { name: 'Preview changes', exact: true }).click()
  const plan = sharing.getByRole('region', { name: 'Synchronization plan' })
  await expect(plan).toContainText('Install reviewed research-lens skill in Cursor')
  const apply = plan.getByRole('button', { name: 'Apply these changes', exact: true })
  await expect(apply).toBeEnabled()
  await captureProvider(page, 'visual-provider-resource-sync-review-plan.png', apply)

  await apply.click()
  const partial = sharing.getByRole('alert').filter({ hasText: 'Sync partly finished' })
  await expect(partial).toContainText('1 steps confirmed · 1 failed')
  await expect(partial).toContainText('Destination changed since preview')
  await expect(partial).toHaveAttribute('role', 'alert')
  await expect(partial.locator('.lucide-triangle-alert')).toBeVisible()
  await expect(partial.getByRole('button', { name: 'Review changed destinations' })).toBeEnabled()
  await expect(partial.getByText('Confirmed operations')).toBeVisible()
  await expect(partial.locator('.resource-sync-confirmed-ops')).toContainText('Already aligned')
  await captureProvider(page, 'visual-provider-resource-sync-partial-result.png', partial)
  await page.setViewportSize({ width: 390, height: 844 })
  await captureProvider(page, 'visual-provider-resource-sync-partial-390.png', partial)
  await page.setViewportSize({ width: 320, height: 720 })
  await expect(partial.getByRole('button', { name: 'Review changed destinations' })).toBeEnabled()
  await captureProvider(page, 'visual-provider-resource-sync-partial-320.png', partial)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => sessionStorage.setItem('e2e:resource-apply-outcome', 'failed'))
  await partial.getByRole('button', { name: 'Review changed destinations' }).click()
  const recheckedApply = plan.getByRole('button', { name: 'Apply these changes', exact: true })
  await expect(recheckedApply).toBeEnabled()
  await captureProvider(page, 'visual-provider-resource-sync-re-reviewed-plan.png', recheckedApply)
  await recheckedApply.click()
  const failure = sharing.getByRole('alert').filter({ hasText: 'Sync could not finish' })
  await expect(failure).toContainText('0 steps confirmed · 1 failed')
  await expect(failure).toContainText('No destination was updated')
  await expect(failure.getByRole('button', { name: 'Review changed destinations' })).toBeEnabled()
  await captureProvider(page, 'visual-provider-resource-sync-no-changes-applied.png', failure)

  await page.evaluate(() => sessionStorage.setItem('e2e:resource-apply-outcome', 'completed'))
  await failure.getByRole('button', { name: 'Review changed destinations' }).click()
  await recheckedApply.click()
  const confirmed = sharing.getByRole('status').filter({ hasText: 'Sync finished' })
  await expect(confirmed).toContainText('2 steps confirmed · 0 failed')
  await expect(confirmed).toContainText('Confirmed operations')
  await expect(sharing.getByRole('alert')).toHaveCount(0)
  await captureProvider(page, 'visual-provider-resource-sync-fully-confirmed.png', confirmed)
})

test('connected Gmail dialog stays bounded at 320px in dark appearance', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.addInitScript(() => window.localStorage.setItem('scriptor:app-theme', 'dark'))
  const panel = await openGmail(page, true)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const inbox = panel.locator('.gmail-manager-message-row').first()
  await expect(inbox).toContainText('Research meeting')
  await captureProvider(page, 'visual-provider-gmail-dark-320.png', inbox)
})

test('Google authorization options remain reachable at 200 percent app zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    window.localStorage.setItem('scriptor:ui-zoom', '2')
    window.sessionStorage.setItem('e2e:google-ecosystem', '1')
    window.sessionStorage.setItem('e2e:research', '1')
    window.sessionStorage.setItem('e2e:google-drive-connected', '0')
  })
  await launchApp(page)
  await expect.poll(() => page.evaluate(() => Number(document.body.style.zoom))).toBe(2)
  const { google } = await openGoogleSettings(page)
  const drive = google.getByRole('group', { name: 'Google Drive & Docs', exact: true })
  const connect = drive.getByRole('button', { name: /^(?:Connect Google|Reconnect) · Google Drive & Docs$/ })
  await expect(connect).toBeEnabled()
  await captureProvider(page, 'visual-provider-google-authorization-zoom-200.png', connect)
})

// Account state persists independently of a draft. Never reproduce an unknown
// outbound Gmail send merely by reopening the compose surface.
test('Gmail retained send-review hold has a distinct acknowledgement and confirmed new-send receipt', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('scriptor:gmail-send-review-required:v1', '1'))
  const panel = await openGmail(page, true)
  await panel.getByRole('tab', { name: 'Compose', exact: true }).click()
  const alert = panel.getByRole('alert')
  await expect(alert).toContainText('Delivery uncertain')
  await expect(alert).toContainText('Check Gmail Sent before another send')
  const send = panel.getByRole('button', { name: 'Send message', exact: true })
  await expect(send).toBeDisabled()
  const reviewed = panel.getByRole('button', { name: 'I checked Gmail Sent; allow another send', exact: true })
  await expect(reviewed).toBeEnabled()
  await captureProvider(page, 'visual-provider-gmail-review-hold-after-reopen.png', reviewed)
  const beforeReview = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:gmail-calls') ?? '[]') as Array<{ cmd: string }>)
    .filter(item => item.cmd === 'google_gmail_send_message'))
  expect(beforeReview).toHaveLength(0)

  await reviewed.click()
  await expect(alert).toHaveCount(0)
  await expect(panel.getByLabel('Subject', { exact: true })).toHaveValue('')
  await expect(send).toBeDisabled()
  await captureProvider(page, 'visual-provider-gmail-reviewed-empty-compose.png', send)
  await panel.getByLabel('Recipient (To)').fill('new-recipient@example.com')
  await panel.getByLabel('Subject', { exact: true }).fill('A freshly reviewed message')
  await panel.getByLabel('Message body (plain text)').fill('This is a new fixture message after reviewing Sent.')
  await send.click()
  const receipt = panel.getByRole('status').filter({ hasText: 'Email sent successfully.' })
  await expect(receipt).toBeVisible()
  await expect(panel.getByLabel('Subject', { exact: true })).toHaveValue('')
  await captureProvider(page, 'visual-provider-gmail-new-send-confirmed.png', receipt)
  const sends = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('e2e:gmail-calls') ?? '[]') as Array<{ cmd: string }>)
    .filter(item => item.cmd === 'google_gmail_send_message'))
  expect(sends).toHaveLength(1)
})


test('Gmail send-review hold remains legible at 390px in high contrast', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('scriptor:app-theme', 'high-contrast')
    localStorage.setItem('scriptor:gmail-send-review-required:v1', '1')
  })
  const panel = await openGmail(page, true)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'high-contrast')
  await panel.getByRole('tab', { name: 'Compose', exact: true }).click()
  const hold = panel.getByRole('alert')
  await expect(hold).toContainText('Delivery uncertain')
  await expect(panel.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled()
  const acknowledgement = panel.getByRole('button', { name: 'I checked Gmail Sent; allow another send', exact: true })
  await expect(acknowledgement).toBeEnabled()
  await captureProvider(page, 'visual-provider-gmail-review-hold-high-contrast-390.png', acknowledgement)
})

test('Expired Google authorization remains distinguishable on dark narrow settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('scriptor:app-theme', 'dark')
    sessionStorage.setItem('e2e:google-ecosystem', '1')
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:google-drive-auth-expired', '1')
    sessionStorage.setItem('e2e:google-calendar-auth-expired', '1')
  })
  await launchApp(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const { google } = await openGoogleSettings(page)
  const drive = google.getByRole('group', { name: 'Google Drive & Docs', exact: true })
  const calendar = google.getByRole('group', { name: 'Google Calendar & Tasks', exact: true })
  const driveReconnect = drive.getByRole('button', { name: 'Reconnect · Google Drive & Docs', exact: true })
  const calendarReconnect = calendar.getByRole('button', { name: 'Reconnect · Google Calendar & Tasks', exact: true })
  await expect(drive.getByRole('alert')).toContainText('Google authorization expired')
  await expect(calendar.getByRole('alert')).toContainText('Google authorization expired')
  await captureProvider(page, 'visual-provider-google-drive-expired-dark-390.png', driveReconnect)
  await calendar.locator('details.google-calendar-options > summary').click()
  await captureProvider(page, 'visual-provider-google-calendar-expired-dark-390.png', calendarReconnect)
})

test('Overleaf line comparison and reviewed actions remain reachable at 200 percent zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('scriptor:ui-zoom', '2'))
  const dialog = await openOverleafReview(page)
  await expect.poll(() => page.evaluate(() => Number(document.body.style.zoom))).toBe(2)
  await dialog.getByRole('button', { name: 'Fetch remote source preview', exact: true }).click()
  const source = dialog.getByLabel('Reviewed source to apply locally or share', { exact: true })
  await expect(source).toHaveValue('\\section{Remote}\n')
  await expect(dialog.locator('.overleaf-diff-line.is-changed')).not.toHaveCount(0)
  const review = dialog.getByLabel('I compared both copies and reviewed this source for the selected action')
  const share = dialog.getByRole('button', { name: 'Share reviewed source with Overleaf', exact: true })
  await expect(share).toBeDisabled()
  await review.check()
  await expect(share).toBeEnabled()
  await captureProvider(page, 'visual-provider-overleaf-reviewed-zoom-200.png', share)
  const pushes = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e:overleaf-calls') ?? '[]') as Array<{ command: string }>)
  expect(pushes.filter(item => item.command === 'overleaf_push')).toHaveLength(0)
})
