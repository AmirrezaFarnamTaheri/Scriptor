import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const load = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')

test('scheduled vault backups have an always-mounted owner rather than a modal lifetime', () => {
  const vault = load('src/hooks/useVaultWorkspace.ts')
  const settings = load('src/components/SettingsPanel.tsx')
  const app = load('src/App.tsx')
  const hook = load('src/hooks/useVaultBackup.ts')
  assert.match(vault, /const backup = useVaultBackup\(/)
  // Repository sources use CRLF on Windows checkouts, so the source-shape
  // assertions must accept either line ending.
  assert.match(vault, /\r?\n\s*backup,\r?\n\s*status,/)
  assert.match(app, /vaultId=\{workspace\.vault\?\.id \?\? null\} backup=\{workspace\.backup\}/)
  assert.match(settings, /backup: ReturnType<typeof useVaultBackup>/)
  assert.doesNotMatch(settings, /const backup = useVaultBackup\(/, 'Settings must not start or stop scheduled work')
  assert.match(hook, /\[settings\.enabled, settings\.intervalMinutes, ownedVaultId\]/)
  assert.match(hook, /operationBusyRef\.current/)
})

test('shared external retention is scoped to the freshly created vault fingerprint', () => {
  const policy = load('src/lib/vaultBackupPolicy.ts')
  const hook = load('src/hooks/useVaultBackup.ts')
  assert.match(policy, /const OWNED_BACKUP_NAME =/)
  assert.match(hook, /backupRetentionCandidates\(allBackups, entry\.name, settings\.maxSnapshots\)/)
  assert.doesNotMatch(hook, /for \(const old of sorted\.slice\(settings\.maxSnapshots\)\)/)
})
