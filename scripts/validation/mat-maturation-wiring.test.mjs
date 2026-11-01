import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const text = name => readFileSync(new URL('../../' + name, import.meta.url), 'utf8')
test('Recovery Center relies on the existing vault-scoped backup hook', () => {
  const code = text('src/components/VaultBackupSettings.tsx')
  assert.match(code, /buildRecoveryInventory\(/)
  assert.match(code, /backupListError/)
  assert.match(code, /backupListLoading/)
  assert.match(code, /verifiedCount: backups\.filter\(entry => entry\.verified\)\.length/)
  assert.match(code, /Recovery Center/)
  assert.match(code, /onOpenNoteHistory/)
})
test('Database Studio must not label the first 200 candidates as full-vault results', () => {
  const code = text('src/components/DatabaseStudioPanel.tsx')
  assert.match(code, /sourceCoverage: 'unverified'/)
  assert.match(code, /evaluateDatabaseQueryCoverage/)
  assert.match(code, /setStatus\(coverage\.description\)/)
  assert.match(code, /DATABASE_ROW_LIMIT/)
  assert.match(code, /vaultListViewNotesPage/)
  assert.match(code, /selectDatabasePage/)
  assert.match(code, /Next candidates/)
})
test('capture acknowledgement and indexing errors are separate and safe to retry', () => {
  const code = text('src/components/CaptureReviewerPanel.tsx')
  assert.match(code, /confirmedPath = path/)
  assert.match(code, /setSource\(''\)/)
  assert.match(code, /Do not resubmit the save/)
  assert.match(code, /native write may have occurred/)
})
